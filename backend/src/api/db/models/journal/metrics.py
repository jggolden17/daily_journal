from datetime import datetime
import uuid
from sqlalchemy import UUID, Float, ForeignKey, String, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from api.db.models.base import Base, TimestampMixin


class MetricsModel(Base, TimestampMixin):
    __tablename__ = "metrics"
    __table_args__ = {"schema": "journal"}

    thread_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal.threads.id", name="journal_thread_fk"),
        nullable=False,
        unique=True,
    )
    asleep_by: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    awoke_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    sleep_quality: Mapped[float] = mapped_column(Float, nullable=True)
    physical_activity: Mapped[float] = mapped_column(Float, nullable=True)
    overall_mood: Mapped[float] = mapped_column(Float, nullable=True)
    hours_paid_work: Mapped[float] = mapped_column(Float, nullable=True)
    hours_personal_work: Mapped[float] = mapped_column(Float, nullable=True)
    additional_metrics: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
