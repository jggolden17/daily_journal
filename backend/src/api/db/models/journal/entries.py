from datetime import datetime
import uuid
from sqlalchemy import UUID, ForeignKey, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from api.db.models.base import Base, TimestampMixin


class EntriesModel(Base, TimestampMixin):
    __tablename__ = "entries"
    __table_args__ = {"schema": "journal"}

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal.threads.id", name="journal_thread_fk"),
        nullable=False,
    )
    encrypted_markdown: Mapped[str] = mapped_column(String, nullable=True)
