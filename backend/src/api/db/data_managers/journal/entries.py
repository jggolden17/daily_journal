"""
Data manager for journal entries with date-based queries.
"""

import datetime as dt
import uuid
from sqlalchemy import select
from api.db.base_data_manager import BaseDataManager
from api.db.models.journal.entries import EntriesModel
from api.db.models.journal.threads import ThreadsModel


class EntriesDataManager(BaseDataManager[EntriesModel]):
    """Data manager for journal entries with date-based queries."""

    async def get_entries_by_date(
        self, user_id: uuid.UUID, date: dt.date
    ) -> list[tuple[EntriesModel, ThreadsModel]]:
        """
        find all entries for a specific date with their threads.
        """
        stmt = (
            select(EntriesModel, ThreadsModel)
            .join(ThreadsModel, EntriesModel.thread_id == ThreadsModel.id)
            .where(ThreadsModel.user_id == user_id)
            .where(ThreadsModel.date == date)
            .order_by(EntriesModel.created_at.asc())
        )

        result = await self.session.execute(stmt)
        return [(row[0], row[1]) for row in result.all()]

    async def get_entry_with_thread(self, entry_id: uuid.UUID) -> EntriesModel | None:
        """
        find an entry with its associated thread.
        """
        stmt = select(EntriesModel).where(EntriesModel.id == entry_id)
        result = await self.session.scalar(stmt)
        return result

    async def count_entries_in_thread(self, thread_id: uuid.UUID) -> int:
        """
        count the number of entries in a thread.
        """
        from sqlalchemy import func

        stmt = select(func.count(EntriesModel.id)).where(
            EntriesModel.thread_id == thread_id
        )
        count = await self.session.scalar(stmt)
        return count or 0

    async def get_dates_with_entries(
        self, user_id: uuid.UUID, start_date: dt.date, end_date: dt.date
    ) -> set[dt.date]:
        """
        find all dates in an inclusive range that have at least one entry.
        """
        stmt = (
            select(ThreadsModel.date)
            .join(EntriesModel, ThreadsModel.id == EntriesModel.thread_id)
            .where(ThreadsModel.user_id == user_id)
            .where(ThreadsModel.date >= start_date)
            .where(ThreadsModel.date <= end_date)
            .distinct()
        )

        result = await self.session.scalars(stmt)
        return set(result.all())
