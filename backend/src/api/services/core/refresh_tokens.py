import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.models.core.refresh_tokens import RefreshTokensModel
from api import JWT_REFRESH_TOKEN_EXPIRE_DAYS


class RefreshTokensService:
    """Service for managing refresh tokens."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_refresh_token_record(
        self, user_id: uuid.UUID, token_hash: str
    ) -> RefreshTokensModel:

        expires_at = datetime.now(timezone.utc) + timedelta(
            days=JWT_REFRESH_TOKEN_EXPIRE_DAYS
        )

        refresh_token = RefreshTokensModel(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )

        self.session.add(refresh_token)
        await self.session.flush()
        await self.session.refresh(refresh_token)
        return refresh_token

    async def get_refresh_token_by_hash(
        self, token_hash: str
    ) -> RefreshTokensModel | None:

        now = datetime.now(timezone.utc)

        stmt = select(RefreshTokensModel).where(
            RefreshTokensModel.token_hash == token_hash,
            RefreshTokensModel.revoked_at.is_(None),
            RefreshTokensModel.expires_at > now,
        )

        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def revoke_refresh_token(self, token_id: uuid.UUID) -> None:
        """
        revokes by setting revoked_at timestamp
        """
        stmt = select(RefreshTokensModel).where(RefreshTokensModel.id == token_id)
        result = await self.session.execute(stmt)
        token = result.scalar_one_or_none()

        if token:
            token.revoked_at = datetime.now(timezone.utc)
            await self.session.flush()

    async def revoke_all_user_tokens(self, user_id: uuid.UUID) -> None:

        now = datetime.now(timezone.utc)

        stmt = select(RefreshTokensModel).where(
            RefreshTokensModel.user_id == user_id,
            RefreshTokensModel.revoked_at.is_(None),
            RefreshTokensModel.expires_at > now,
        )

        result = await self.session.execute(stmt)
        tokens = result.scalars().all()

        for token in tokens:
            token.revoked_at = now

        if tokens:
            await self.session.flush()

    async def cleanup_expired_tokens(self) -> int:
        """
        Remove expired and revoked tokens from the database
        returns # deleted tokens
        """
        now = datetime.now(timezone.utc)

        stmt = select(RefreshTokensModel).where(
            (RefreshTokensModel.expires_at < now)
            | (RefreshTokensModel.revoked_at.isnot(None))
        )

        result = await self.session.execute(stmt)
        tokens = result.scalars().all()

        count = len(tokens)
        for token in tokens:
            await self.session.delete(token)

        if count > 0:
            await self.session.flush()

        return count
