from datetime import datetime
from sqlalchemy import String, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from api.db.models.base import Base, TimestampMixin


class UsersModel(Base, TimestampMixin):
    __tablename__ = "users"
    # uq_users_external_auth_sub
    __table_args__ = (
        UniqueConstraint(
            "external_auth_sub", "email", name="uq_users_external_auth_sub_email"
        ),
        {"schema": "core"},
    )

    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    external_auth_sub: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    picture: Mapped[str | None] = mapped_column(String, nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
