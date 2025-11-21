from datetime import datetime
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from api.db.models.base import Base, TimestampMixin


class UsersModel(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = {"schema": "core"}

    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    external_auth_sub: Mapped[str] = mapped_column(String, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
