import datetime as dt
import uuid
from sqlalchemy import ForeignKey, String, DateTime, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from api.db.models.base import Base, TimestampMixin
from sqlalchemy.types import Date


class ThreadsModel(Base, TimestampMixin):
    __tablename__ = "threads"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_threads_user_id_date"),
        {"schema": "journal"},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("core.users.id", name="core_user_fk"),
        nullable=False,
    )
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
