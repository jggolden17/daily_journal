"""
Base data manager for all models.
"""

import uuid
from api.db.database import DBSessionDep
from sqlalchemy import ColumnElement, func, select, Table, delete
import datetime as dt
from typing import Any, Iterable, Sequence, TypeVar, Generic, cast
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import (
    MultipleResultsFound,
    SQLAlchemyError,
    IntegrityError,
    ProgrammingError,
)
from api.api_schemas.generic import PageParams, SortParams
from sqlalchemy.sql.base import ReadOnlyColumnCollection
from sqlalchemy.sql.elements import KeyedColumnElement
from sqlalchemy.sql.expression import Executable, Select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from api.utils.logger import log
from sqlalchemy.sql.roles import WhereHavingRole


def _is_foreign_key_violation(error: IntegrityError) -> bool:
    """Check if an IntegrityError is a foreign key constraint violation.
    Used so when raising errors I have better control over the error code.
    note - pg fk violations have error code 23503.
    """
    if (
        hasattr(error, "orig")
        and error.orig is not None
        and hasattr(error.orig, "pgcode")
    ):
        return error.orig.pgcode == "23503"
    # fallback: check error message for fk ref
    error_str = str(error).lower()
    return "foreign key" in error_str or "violates foreign key constraint" in error_str


class DataValidationError(Exception):
    """Raised when query parameters for data manager are invalid."""

    def __init__(self, message: str, code: int | None = None):
        super().__init__(message)
        self.code: int = code or 400


# db model type when getting specific implementation of base data manager (eg. ThreadsModel)
TModel = TypeVar("TModel", bound=DeclarativeBase)


class SessionMixin:
    """Provides instance of db session."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session


class BaseDataManager(Generic[TModel], SessionMixin):
    """Base data manager for all db models."""

    def __init__(self, session: DBSessionDep, model: type[TModel]):
        super().__init__(session)
        self.model: type[TModel] = model

    # #########################################################################################
    # UTILS
    # #########################################################################################

    def _apply_sort(
        self, stmt: Select, model: type[TModel], sort_params: SortParams
    ) -> Select:

        sort_by = sort_params.sort_by
        direction = sort_params.sort_direction

        if not sort_by or not direction:
            return stmt

        sort_col = model.__table__.c.get(sort_by)
        if sort_col is None:
            valid_cols = list(model.__table__.c.keys())
            raise DataValidationError(
                f"Invalid sort column '{sort_by}'. Valid columns: {valid_cols}",
            )

        dir_lower = direction.lower()
        if dir_lower not in {"asc", "desc"}:
            raise DataValidationError(
                "sort_direction must be 'asc' or 'desc', but got '{direction}'",
            )

        stmt = stmt.order_by(sort_col.desc() if dir_lower == "desc" else sort_col)
        return stmt

    def _get_table_columns(self) -> set[str]:
        """Get set of valid column names for the model."""
        return set(self.model.__table__.columns.keys())

    def _get_id_column(self):
        """Get the id column from the model table."""
        return self.model.__table__.c.id

    def _strip_blocked_fields(
        self,
        changes: dict[str, Any],
        *,
        blocked: Sequence[str] = ("id", "created_at", "updated_at"),
    ) -> dict[str, Any]:
        """strip blocked fields from changes dict (useful when patching)"""
        if not changes:
            return changes
        return {k: v for k, v in changes.items() if k not in blocked}

    def _build_changes_dict(
        self,
        patch: BaseModel,
        current_time: dt.datetime,
        valid_columns: set[str],
    ) -> dict[str, Any]:
        """
        safely convert a patch schema into a dict of column --> value changes
        """
        changes = patch.model_dump(exclude_unset=True)
        changes = self._strip_blocked_fields(changes)

        unknown_fields = set(changes) - valid_columns
        if unknown_fields:
            raise DataValidationError(
                f"Unknown fields {sorted(unknown_fields)!r} for {self.model.__name__}. "
                f"Valid fields: {sorted(valid_columns)}",
                code=422,
            )

        # Ensure all datetime values are timezone-aware UTC
        changes.update(
            {
                field_name: value.replace(tzinfo=dt.timezone.utc)
                for field_name, value in changes.items()
                if isinstance(value, dt.datetime) and value.tzinfo is None
            }
        )
        if changes and "updated_at" in valid_columns:
            changes["updated_at"] = current_time

        return changes

    def _get_safe_update_cols(
        self,
        table: Table,
        blocked_update_fields: Iterable[str],
        conflict_columns: Iterable[str],
    ) -> list[str]:
        """
        get list of upsert-safe cols in tbl
        """
        table_cols = set(table.c.keys())
        blocked_set = set(blocked_update_fields)
        conflict_set = set(conflict_columns)

        return [
            col
            for col in table_cols
            if col not in blocked_set and col not in conflict_set
        ]

    def _build_upsert_where_clause(
        self,
        table: Table,
        upsert_cols: list[str],
        stmt_excluded: ReadOnlyColumnCollection[str, KeyedColumnElement[Any]],
    ) -> WhereHavingRole | None:
        """
        build WHERE clause for conditional upsert updates
        Updates when any field is different from excluded.

        'stmt.excluded' refers to the special SQLAlchemy insert().excluded namespace
        It represents the row values proposed for insertion in the ON CONFLICT ... DO UPDATE context,
        i.e., the values that would have been inserted but caused a conflict


        Args:
            table: SQLAlchemy Table object
            upsert_cols: List of columns being updated
            stmt_excluded: EXCLUDED reference from insert statement

        Returns:
            SQLAlchemy expression for WHERE clause,
            e.g. (email IS DISTINCT FROM excluded.email) OR (name IS DISTINCT FROM excluded.name)
        """

        diffs = [
            table.c[col].is_distinct_from(getattr(stmt_excluded, col))
            for col in upsert_cols
            if col != "updated_at"
        ]

        return or_(*diffs) if diffs else None

    def _build_upsert_set_map(
        self,
        safe_update_cols: list[str],
        stmt_excluded: ReadOnlyColumnCollection[str, KeyedColumnElement[Any]],
    ) -> dict[str, Any]:
        """
        build the mapping for upsert update clause (i.e. what to update on conflict)
        """
        return {col: getattr(stmt_excluded, col) for col in safe_update_cols}

    async def _get_upserted_rows_by_conflict_cols(
        self,
        upsert_rows: Sequence[dict[str, Any]],
        unique_constr_cols: Iterable[str],
    ) -> list[TModel]:
        """find & return the rows we upserted.
        - doing this via unique constraint cols is more reliable than trying to parse the RETURNING clause results

        Args:
            upsert_rows (Sequence[dict[str, Any]]): the rows requested to be upserted
            conflict_columns (Iterable[str]): the cols that uniquely identify a row (hence used to check for existing rows)

        Returns:
            list[TModel]: the rows that were upserted
        """

        # first get the relevant filters for each row
        table = cast(Table, self.model.__table__)
        conflict_filters = []
        for row in upsert_rows:
            row_filters = []
            # if col defining a unique constraint in row, filter for it
            for col_name in unique_constr_cols:
                if col_name in row:
                    col = table.c[col_name]
                    row_filters.append(col == row[col_name])
            if row_filters:
                # find only rows matching all unque constraints
                conflict_filters.append(and_(*row_filters))

        if not conflict_filters:
            return []

        # use OR to combine different rows
        query = select(self.model).where(or_(*conflict_filters))
        existing_objs = await self.session.scalars(query)
        return list(existing_objs.all())

    # #########################################################################################
    # READs
    # #########################################################################################

    async def get_one_or_none(self, select_stmt: Executable) -> TModel | None:
        try:
            result = await self.session.scalar(select_stmt)
        except MultipleResultsFound:
            raise DataValidationError(
                f"Multiple results found when expecting <=1 in table {self.model.__name__}"
            )
        return result

    async def get_one_or_none_by_id(self, id: uuid.UUID) -> TModel | None:
        stmt = select(self.model).where(self._get_id_column() == id)
        return await self.get_one_or_none(stmt)

    async def get_one_or_none_generic(
        self, column_name: str, value: Any
    ) -> TModel | None:
        stmt = select(self.model).where(getattr(self.model, column_name) == value)
        return await self.get_one_or_none(stmt)

    async def get_many_by_ids(self, ids: Sequence[uuid.UUID]) -> list[TModel]:
        if not ids:
            return []

        stmt = select(self.model).where(self._get_id_column().in_(ids))
        result = await self.session.scalars(stmt)
        return list(result.all())

    async def get_count(self, select_stmt: Select) -> int:
        """given select stmt, return count of models returned"""
        count_stmt = select(func.count()).select_from(select_stmt.subquery())
        count = await self.session.scalar(count_stmt)
        return count or 0

    async def get_page(
        self, select_stmt: Select, page_params: PageParams
    ) -> list[TModel]:
        """given select stmt and page params with current page & page size, return models for page"""

        select_stmt_paged = select_stmt.limit(page_params.page_size).offset(
            (page_params.current_page - 1) * page_params.page_size
        )
        data = await self.session.scalars(select_stmt_paged)
        return list(data.all())

    async def get_all_paginated(
        self,
        ids: Sequence[uuid.UUID] | None,
        page_params: PageParams,
        sort_params: SortParams,
    ) -> tuple[list[TModel], int]:
        stmt = select(self.model)

        if ids:
            stmt = stmt.where(self._get_id_column().in_(ids))

        stmt = self._apply_sort(stmt, self.model, sort_params)

        return (
            await self.get_page(stmt, page_params),
            await self.get_count(stmt),
        )

    # #########################################################################################
    # CREATEs
    # #########################################################################################

    async def add_rows(self, models: Sequence[TModel]) -> Sequence[TModel]:

        try:
            self.session.add_all(models)
            await self.session.flush()
            return list(models)
        except Exception as e:
            await self.session.rollback()
            if isinstance(e, IntegrityError):
                log.exception(
                    f"Integrity error while adding {self.model.__name__} instances",
                )
                if _is_foreign_key_violation(e):
                    raise DataValidationError(
                        f"Referenced record not found while creating {self.model.__name__} instances: {e}",
                        code=404,
                    ) from e
                raise DataValidationError(
                    f"Integrity error while creating {self.model.__name__} instances: {e}",
                    code=409,
                ) from e
            elif isinstance(e, SQLAlchemyError):
                log.exception(
                    f"Database error while adding {self.model.__name__} instances"
                )
                raise DataValidationError(
                    f"Database error while creating {self.model.__name__} instances: {e}",
                    code=500,
                ) from e
            else:
                log.exception(
                    f"Unexpected error while adding {self.model.__name__} instances"
                )
                raise DataValidationError(
                    f"Unexpected error while creating {self.model.__name__} instances: {e}",
                    code=500,
                ) from e

    # #########################################################################################
    # PATCHes
    # #########################################################################################

    async def patch_one_by_id(
        self,
        pk: uuid.UUID,
        patch: BaseModel,
        current_time: dt.datetime,
    ) -> TModel:
        """
        Partially update a single row
        Only fields provided in 'patch' are updated. None means set NULL.
        """
        obj = await self.get_one_or_none_by_id(pk)

        if not obj:
            raise DataValidationError(
                f"Record not found for id {pk} in table {self.model.__name__}",
                code=404,
            )

        valid_columns = self._get_table_columns()
        changes = self._build_changes_dict(
            patch=patch,
            current_time=current_time,
            valid_columns=valid_columns,
        )

        if not changes:
            return obj

        for field, value in changes.items():
            setattr(obj, field, value)

        try:
            await self.session.flush()
            return obj
        except Exception as e:
            await self.session.rollback()

            if isinstance(e, IntegrityError):
                if _is_foreign_key_violation(e):
                    raise DataValidationError(
                        f"Referenced record not found while updating {self.model.__name__} instance: {e}",
                        code=404,
                    ) from e
                raise DataValidationError(
                    f"Integrity error while updating {self.model.__name__} instance: {e}",
                    code=409,
                ) from e

            raise DataValidationError(
                f"Unexpected error while updating {self.model.__name__} instance: {e}",
                code=500,
            ) from e

    async def patch_many_by_ids(
        self,
        patches: Sequence[tuple[uuid.UUID, BaseModel]],
        current_time: dt.datetime,
    ) -> list[TModel]:
        """
        Partially update many rows identified by primary key.

        For each (pk, patch), only fields provided in 'patch' are updated.
        None means set NULL.
        """
        if not patches:
            return []

        valid_columns = self._get_table_columns()

        # track which pks we actually need to modify, and original order
        pks_with_changes: list[uuid.UUID] = []
        patch_data: list[dict[str, Any]] = []
        all_pks = [pk for pk, _ in patches]

        for pk, patch in patches:
            changes = self._build_changes_dict(
                patch=patch,
                current_time=current_time,
                valid_columns=valid_columns,
            )

            if not changes:
                # obj still expected to be returned in correct order
                continue

            changes["_pk"] = pk
            patch_data.append(changes)
            pks_with_changes.append(pk)

        rows = await self.get_many_by_ids(all_pks)
        id_col = self._get_id_column()

        objects_by_pk: dict[uuid.UUID, TModel] = {
            getattr(obj, id_col.name): obj for obj in rows
        }

        missing_pks = set(all_pks) - set(objects_by_pk.keys())
        if missing_pks:
            raise DataValidationError(
                f"Records not found for IDs: {sorted(missing_pks)}",
                code=404,
            )

        for patch_dict in patch_data:
            pk = patch_dict.pop("_pk")
            obj = objects_by_pk[pk]

            for field, value in patch_dict.items():
                setattr(obj, field, value)

        try:
            if patch_data:
                # only flush if there are actual changes
                await self.session.flush()

            # return in the same order
            return [objects_by_pk[pk] for pk in all_pks]
        except Exception as e:
            await self.session.rollback()

            if isinstance(e, IntegrityError):

                if _is_foreign_key_violation(e):
                    raise DataValidationError(
                        f"Referenced record not found while updating {self.model.__name__} instances: {e}",
                        code=404,
                    ) from e
                raise DataValidationError(
                    f"Integrity error while updating {self.model.__name__} instances: {e}",
                    code=409,
                ) from e

            raise DataValidationError(
                f"Unexpected error while updating {self.model.__name__} instances: {e}",
                code=500,
            ) from e

    # #########################################################################################
    # UPSERTs
    # #########################################################################################

    async def upsert_rows(
        self,
        upsert_rows: Sequence[dict[str, Any]],
        *,
        unique_constr_cols: Iterable[str],
        blocked_update_fields: Iterable[str] = ("id", "created_at"),
    ) -> list[TModel]:
        """upsert using pg ON CONFLICT
        - following: https://www.postgresql.org/docs/current/sql-insert.html
        - useful for upserting without having to first work out what does/doesn't exist

        for e.g., produces sql of the form::
            ```sql
            INSERT INTO
                journal.entries
                (
                    thread_id,
                    encrypted_markdown
                )
            VALUES
                (
                    'example-uuid-thread-id',
                    '# Example entry'
                )
            ON CONFLICT (thread_id) -- i.e, if error occurs due to duplicate thread_id, instead do below logic
                DO UPDATE
                    SET
                        updated_at = EXCLUDED.updated_at,
                        encrypted_markdown = EXCLUDED.encrypted_markdown
                    WHERE (
                        -- only update if encrypted_markdown is different from the proposed insert
                        journal.entries.encrypted_markdown IS DISTINCT FROM EXCLUDED.encrypted_markdown
                    )
            RETURNING
                journal.entries.id,
                journal.entries.thread_id,
                -- etc. for all cols in the table
            ```

        Args:
            upsert_rows (Sequence[dict[str, Any]]): keys matching model columns, expected to be validated before calling func
            conflict_columns (Iterable[str]): the cols that uniquely identify a row (hence used to check for existing rows)
            blocked_update_fields (Iterable[str], optional): _description_. Defaults to ("id", "created_at").

        Returns:
            list[TModel]: list of models that were upserted
        """
        if not upsert_rows:
            log.info("No rows provided for upsert")
            return []

        if any("id" in row for row in upsert_rows):
            raise DataValidationError(
                "Upsert operations cannot include an 'id' field. "
                "If you know the ID, use PATCH instead. "
                "Upsert is only for cases where you don't know if a record already exists.",
                code=422,
            )

        # get the insert stmt
        table = cast(Table, self.model.__table__)
        stmt = pg_insert(table).values(upsert_rows)

        # get cols to update on conflict
        safe_update_cols = self._get_safe_update_cols(
            table, blocked_update_fields, unique_constr_cols
        )

        # construct upsert stmt
        if not safe_update_cols:
            # if here, there is nothing to update - all cols are cols that shouldn't be updated
            # --> just do nothing if conflict
            upsert_stmt = stmt.on_conflict_do_nothing(
                index_elements=list(unique_constr_cols),
            ).returning(self.model)
        else:
            # build WHERE clause that checks if anything is actually getting updated
            # --> only update if the proposed insert is different from the current row
            where_clause: WhereHavingRole | None = self._build_upsert_where_clause(
                table,
                safe_update_cols,
                stmt.excluded,
            )

            # build set-map (i.e. which cols to update on conflict)
            set_map = self._build_upsert_set_map(safe_update_cols, stmt.excluded)

            # Construct the upsert statement with update
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=list(unique_constr_cols),
                set_=set_map,
                where=where_clause,
            ).returning(self.model)

        try:
            # Execute the upsert statement
            await self.session.execute(upsert_stmt)
            await self.session.flush()

            # easier to query for the models using unique constraint cols to ensure we get proper ORM instances
            # found this more reliable / straightforward than trying to parse the RETURNING clause results
            objs = await self._get_upserted_rows_by_conflict_cols(
                upsert_rows, unique_constr_cols
            )

            return objs
        except Exception as e:
            await self.session.rollback()
            if isinstance(e, IntegrityError):

                if _is_foreign_key_violation(e):
                    raise DataValidationError(
                        f"Referenced record not found while upserting {self.model.__name__} instances: {e}",
                        code=404,
                    ) from e
                raise DataValidationError(
                    f"Integrity error while upserting {self.model.__name__} instances: {e}",
                    code=409,
                ) from e
            elif isinstance(e, ProgrammingError):
                # ProgrammingError often indicates issues with SQL syntax or constraint references
                log.exception(
                    f"Programming error while upserting {self.model.__name__} instances"
                )
                raise DataValidationError(
                    f"Database error while upserting {self.model.__name__} instances. "
                    f"Unique constraint columns may not match a unique constraint: {e}",
                    code=422,
                ) from e
            else:
                import traceback

                log.exception(
                    f"Unexpected error while upserting {self.model.__name__} instances: {type(e).__name__}: {e}\n{traceback.format_exc()}"
                )
                raise DataValidationError(
                    f"Unexpected error while upserting {self.model.__name__} instances: {type(e).__name__}: {str(e)}",
                    code=500,
                )

    # #########################################################################################
    # DELETEs
    # #########################################################################################

    async def delete_rows(self, models: Sequence[TModel]) -> None:
        """
        delete multiple models using bulk delete operation.
        """
        if not models:
            return

        try:
            pks = [getattr(model, "id") for model in models]

            stmt = delete(self.model).where(self._get_id_column().in_(pks))
            await self.session.execute(stmt)
            await self.session.flush()
        except Exception as e:
            await self.session.rollback()
            log.error(f"Error deleting rows, rolling back: {e}")
            raise DataValidationError(
                f"Failed to delete records: {e}",
                code=409,
            ) from e
