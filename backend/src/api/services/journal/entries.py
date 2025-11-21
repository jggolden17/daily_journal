import datetime as dt
import uuid
from typing import TYPE_CHECKING
from api.db.data_managers.journal.entries import EntriesDataManager
from api.db.models.journal.entries import EntriesModel
from api.api_schemas.journal.entries import (
    EntryCreateSchema,
    EntryPatchSchema,
)
from api.services.base_service import BaseService
from api.services.journal.threads import ThreadsService
from api.api_schemas.journal.threads import ThreadUpsertSchema
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    # avoids a circular import only used for type checking threads..
    from api.db.models.journal.threads import ThreadsModel


def populate_create_model(
    schema: EntryCreateSchema,
    current_time: dt.datetime,
):
    """Convert EntryCreateSchema to EntriesModel instance."""
    schema_dict = schema.model_dump()
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

    async def get_entries_by_date(
        self, user_id: uuid.UUID, date: dt.date
    ) -> list[tuple[EntriesModel, "ThreadsModel"]]:
        """get all entries for a specific date with their threads."""
        data_manager_inst = self.data_manager(self.session, self.model)
        return await data_manager_inst.get_entries_by_date(user_id, date)

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
        entries = await self.create(schemas=[entry_schema])

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
