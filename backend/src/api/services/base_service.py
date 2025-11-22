import datetime as dt
import uuid
from typing import Any, TypeVar, Callable, Generic, Sequence, Iterable
from api.utils.logger import log
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from api.db.base_data_manager import (
    BaseDataManager,
    DataValidationError,
    SessionMixin,
    TModel,
)
from api.api_schemas.generic import PageParams, SortParams


def get_utc_now() -> dt.datetime:
    """
    get time when method called rather than when class instantiated
    """
    return dt.datetime.now(dt.timezone.utc)


DMType = TypeVar("DMType", bound=BaseDataManager)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
PatchSchemaType = TypeVar("PatchSchemaType", bound=BaseModel)
UpsertSchemaType = TypeVar("UpsertSchemaType", bound=BaseModel)

ToCreateModelFn = Callable[[CreateSchemaType, "dt.datetime"], TModel]
ToPatchModelFn = Callable[[PatchSchemaType, TModel, "dt.datetime"], TModel]
ToUpsertModelFn = Callable[[UpsertSchemaType, "dt.datetime"], TModel]


class BaseService(
    SessionMixin, Generic[DMType, TModel, CreateSchemaType, PatchSchemaType]
):
    def __init__(
        self,
        session: AsyncSession,
        data_manager: type[DMType],
        model: type[TModel],
        create_schema: type[CreateSchemaType],
        patch_schema: type[PatchSchemaType],
        to_create_model: ToCreateModelFn,
    ):
        super().__init__(session)
        self.model = model
        self.data_manager = data_manager
        self.create_schema = create_schema
        self.patch_schema = patch_schema
        self.populate_create_model = to_create_model

    def _check_for_missing_ids(
        self,
        existing_ids: Sequence[uuid.UUID],
        provided_ids: Sequence[uuid.UUID],
        id_name: str = "ids",
    ) -> None:
        missing_ids = list(set(provided_ids) - set(existing_ids))
        if missing_ids:
            raise DataValidationError(
                f"{id_name} not found: {', '.join([str(id) for id in missing_ids])}",
                code=404,
            )

    async def get_one_or_none_by_id(
        self,
        id: uuid.UUID,
    ) -> TModel | None:
        data_manager_inst = self.data_manager(self.session, self.model)
        return await data_manager_inst.get_one_or_none_by_id(id)

    async def get_one_or_none(
        self,
        column_name: str,
        value: Any,
    ) -> TModel | None:
        data_manager_inst = self.data_manager(self.session, self.model)
        return await data_manager_inst.get_one_or_none_generic(column_name, value)

    async def get_all_paginated(
        self,
        ids: Sequence[uuid.UUID] | None,
        page_params: PageParams,
        sort_params: SortParams,
    ) -> tuple[list[TModel], int]:
        data_manager_inst = self.data_manager(self.session, self.model)
        return await data_manager_inst.get_all_paginated(
            ids=ids,
            page_params=page_params,
            sort_params=sort_params,
        )

    async def create(
        self,
        schemas: list[CreateSchemaType],
    ) -> list[TModel]:

        current_time = get_utc_now()
        models = [
            self.populate_create_model(schema, current_time) for schema in schemas
        ]
        data_manager_inst = self.data_manager(self.session, self.model)
        result = await data_manager_inst.add_rows(models)
        return list(result)

    async def patch(
        self,
        schemas: list[PatchSchemaType],
    ) -> list[TModel]:
        current_time = get_utc_now()
        ids = [getattr(schema, "id") for schema in schemas]

        if None in ids:
            raise DataValidationError(
                "All patch schemas must include an 'id' field",
                code=422,
            )

        row_updates = list(zip(ids, schemas))
        data_manager_inst = self.data_manager(self.session, self.model)
        updated_models = await data_manager_inst.patch_many_by_ids(
            row_updates, current_time=current_time
        )

        return updated_models

    async def upsert(
        self,
        schemas: list[UpsertSchemaType],
        *,
        unique_constr_cols: Iterable[str],
        blocked_update_fields: Iterable[str] = ("id", "created_at"),
    ) -> list[TModel]:
        """
        upsert records based on unique constraints (not IDs).
        if a record matching the unique constraint cols exists, it will be updated.
        otherwise, a new record will be created.
        """
        if not schemas:
            log.warning("No schemas provided for upsert")
            return []

        # Explicitly validate that no schemas contain an 'id' field
        if any(
            hasattr(schema, "id") and getattr(schema, "id", None) is not None
            for schema in schemas
        ):
            raise DataValidationError(
                "Upsert operations cannot include an 'id' field. "
                "If you know the ID, use PATCH instead. "
                "Upsert is only for cases where you don't know if a record already exists.",
                code=422,
            )

        data_manager_inst = self.data_manager(self.session, self.model)

        upsert_dicts = [schema.model_dump() for schema in schemas]

        if upsert_dicts:
            upsert_results = await data_manager_inst.upsert_rows(
                upsert_dicts,
                unique_constr_cols=unique_constr_cols,
                blocked_update_fields=blocked_update_fields,
            )
            return upsert_results

        return []

    async def delete(
        self,
        ids: Sequence[uuid.UUID],
    ) -> None:

        data_manager_inst = self.data_manager(self.session, self.model)

        existing_models, _ = await data_manager_inst.get_all_paginated(
            ids=ids,
            page_params=PageParams(current_page=1, page_size=len(ids)),
            sort_params=SortParams(sort_by="id", sort_direction="asc"),
        )
        existing_ids = [getattr(m, "id") for m in existing_models]
        self._check_for_missing_ids(
            existing_ids, ids, f"{self.model.__tablename__.replace('_', ' ').title()}"
        )

        await data_manager_inst.delete_rows(existing_models)
