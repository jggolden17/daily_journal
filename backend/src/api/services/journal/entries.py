import datetime as dt
import uuid
from typing import TYPE_CHECKING, Sequence
from api.db.data_managers.journal.entries import EntriesDataManager
from api.db.models.journal.entries import EntriesModel
from api.api_schemas.journal.entries import (
    EntryCreateSchema,
    EntryPatchSchema,
)
from api.services.base_service import BaseService
from api.services.journal.threads import ThreadsService
from api.api_schemas.journal.threads import ThreadUpsertSchema
from api.utils.encryption import get_encryption_service
from sqlalchemy.ext.asyncio import AsyncSession

from api.utils.logger import log

if TYPE_CHECKING:
    # avoids a circular import only used for type checking threads..
    from api.db.models.journal.threads import ThreadsModel
    from api.api_schemas.generic import PageParams, SortParams


def populate_create_model(
    schema: EntryCreateSchema,
    current_time: dt.datetime,
):
    """Convert EntryCreateSchema to EntriesModel instance."""
    encryption_service = get_encryption_service()
    schema_dict = schema.model_dump()

    # don't store raw md, encrypt it first
    raw_markdown = schema_dict.get("raw_markdown")
    if raw_markdown is not None:
        try:
            encrypted_markdown = encryption_service.encrypt(raw_markdown)
            if encrypted_markdown is None:
                log.error("populate_create_model() - encryption returned None")
                raise ValueError(
                    "Encryption returned None - data would be stored unencrypted"
                )
            # TODO: change name of col from raw to encrypted to make this clear
            schema_dict["raw_markdown"] = encrypted_markdown
        except Exception as e:

            raise ValueError(
                f"Encryption failed - cannot store unencrypted data: {e}"
            ) from e

    schema_dict.update(
        {
            "created_at": current_time,
            "updated_at": current_time,
        }
    )

    return EntriesModel(**schema_dict)


class EntriesService(
    BaseService[
        EntriesDataManager,
        EntriesModel,
        EntryCreateSchema,
        EntryPatchSchema,
    ]
):
    """service for managing journal entries."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            session,
            data_manager=EntriesDataManager,
            model=EntriesModel,
            create_schema=EntryCreateSchema,
            patch_schema=EntryPatchSchema,
            to_create_model=populate_create_model,
        )
        self._encryption_service = get_encryption_service()

    def _decrypt_entry(self, entry: EntriesModel) -> EntriesModel:
        """Decrypt raw_markdown field in an entry model."""
        if entry.raw_markdown is not None:
            encrypted_value = entry.raw_markdown
            decrypted = self._encryption_service.decrypt(encrypted_value)
            # seen issues w type checker & SQLAlchemy mapped columns, so use setattr here
            setattr(entry, "raw_markdown", decrypted)
        return entry

    def _decrypt_entries(self, entries: list[EntriesModel]) -> list[EntriesModel]:
        """Decrypt raw_markdown field in a list of entry models."""
        for entry in entries:
            self._decrypt_entry(entry)
        return entries

    async def _prevent_sqlalch_tracking_entries_further(
        self, entries: list[EntriesModel]
    ) -> None:
        """without this, when decrypting, sqlalch will overwrite the encrypted data with the decrypted data on commit,
        which makes the entire encryption process pointless. This works, tells sqlalch to ignore enries.
        Call before decrypyting
        """
        # Ensure encrypted data is flushed to database before expunging
        await self.session.flush()
        for entry in entries:
            try:
                self.session.expunge(entry)
            except Exception as e:
                log.warning(f"Failed to expunge entry {entry.id}: {e}")

    async def create_with_encryption(
        self,
        schemas: list[EntryCreateSchema],
    ) -> list[EntriesModel]:
        """Create entries with encrypted raw_markdown and return decrypted."""
        entries = await super().create(schemas=schemas)
        await self._prevent_sqlalch_tracking_entries_further(entries)
        return self._decrypt_entries(entries)

    async def patch_with_encryption(
        self,
        schemas: list[EntryPatchSchema],
    ) -> list[EntriesModel]:
        """Patch entries with encrypted raw_markdown and return decrypted."""
        # encrypt md before patching
        encrypted_schemas = []
        for idx, schema in enumerate(schemas):
            schema_dict = schema.model_dump(exclude_unset=True)
            raw_markdown = schema_dict.get("raw_markdown")
            if raw_markdown is not None:
                try:
                    encrypted_markdown = self._encryption_service.encrypt(raw_markdown)
                    if encrypted_markdown is None:
                        raise ValueError("Encryption returned None during patch")
                    schema_dict["raw_markdown"] = encrypted_markdown
                    encrypted_schema = EntryPatchSchema(**schema_dict)
                    encrypted_schemas.append(encrypted_schema)
                except Exception as e:

                    raise ValueError(f"Encryption failed during patch: {e}") from e
            else:
                encrypted_schemas.append(schema)

        entries = await super().patch(schemas=encrypted_schemas)
        await self._prevent_sqlalch_tracking_entries_further(entries)
        return self._decrypt_entries(entries)

    async def get_one_or_none_by_id_with_decryption(
        self,
        id: uuid.UUID,
    ) -> EntriesModel | None:
        """Get entry by ID and decrypt raw_markdown."""
        entry = await super().get_one_or_none_by_id(id)
        if entry:
            return self._decrypt_entry(entry)
        return None

    async def get_all_paginated_with_decryption(
        self,
        ids: Sequence[uuid.UUID] | None,
        page_params: "PageParams",
        sort_params: "SortParams",
    ) -> tuple[list[EntriesModel], int]:
        """Get paginated entries and decrypt raw_markdown."""
        entries, total = await super().get_all_paginated(
            ids=ids,
            page_params=page_params,
            sort_params=sort_params,
        )
        return (self._decrypt_entries(entries), total)

    async def get_entries_by_date(
        self, user_id: uuid.UUID, date: dt.date
    ) -> list[tuple[EntriesModel, "ThreadsModel"]]:
        """get all entries for a specific date with their threads."""
        data_manager_inst = self.data_manager(self.session, self.model)
        entries_with_threads = await data_manager_inst.get_entries_by_date(
            user_id, date
        )
        # Decrypt raw_markdown for all entries
        # expunge entries before decrypting to prevent SQLAlchemy from writing decrypted values back
        entries_list = [entry for entry, _ in entries_with_threads]
        await self._prevent_sqlalch_tracking_entries_further(entries_list)
        decrypted_results = [
            (self._decrypt_entry(entry), thread)
            for entry, thread in zip(
                entries_list, [thread for _, thread in entries_with_threads]
            )
        ]
        return decrypted_results

    async def get_days_with_entries(
        self, user_id: uuid.UUID, start_date: dt.date, end_date: dt.date
    ) -> set[dt.date]:
        """
        get all dates in a range that have at least one entry.
        """
        data_manager_inst = self.data_manager(self.session, self.model)
        return await data_manager_inst.get_dates_with_entries(
            user_id, start_date, end_date
        )

    async def create_entry_with_thread(
        self, user_id: uuid.UUID, date: dt.date, raw_markdown: str | None = None
    ) -> EntriesModel:
        """
        create an entry and upsert the thread for the given date.
        """
        threads_service = ThreadsService(self.session)
        thread_schema = ThreadUpsertSchema(user_id=user_id, date=date)
        threads = await threads_service.upsert(
            schemas=[thread_schema],
            unique_constr_cols=("user_id", "date"),
            blocked_update_fields=["id", "created_at"],
        )

        if not threads:
            raise ValueError("Failed to create or retrieve thread")
        if len(threads) != 1:
            raise ValueError(f"Expected exactly one thread, but got {len(threads)}")
        thread = threads[0]

        entry_schema = EntryCreateSchema(thread_id=thread.id, raw_markdown=raw_markdown)
        entries = await self.create_with_encryption(schemas=[entry_schema])

        if not entries:
            raise ValueError("Failed to create entry")

        if len(entries) != 1:
            raise ValueError(f"Expected exactly one entry, but got {len(entries)}")
        return entries[0]

    async def delete_entry_with_thread_cleanup(self, entry_id: uuid.UUID) -> None:
        """
        delete an entry and its thread if it's the last entry in the thread.
        """
        data_manager_inst = self.data_manager(self.session, self.model)
        entry = await data_manager_inst.get_entry_with_thread(entry_id)

        if not entry:
            from api.db.base_data_manager import DataValidationError

            raise DataValidationError(
                f"Entry not found for id {entry_id}",
                code=404,
            )

        thread_id = entry.thread_id

        await self.delete(ids=[entry_id])

        entry_count = await data_manager_inst.count_entries_in_thread(thread_id)

        # If no other entries exist, delete the thread
        if entry_count == 0:
            threads_service = ThreadsService(self.session)
            await threads_service.delete(ids=[thread_id])
