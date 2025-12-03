import os
import contextlib
from typing import Any, AsyncIterator, Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    AsyncConnection,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from api import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

# --------------------------------------------------------------------------------------------------------------------------------
# set-ups
# --------------------------------------------------------------------------------------------------------------------------------

DATABASE_URL_DEFAULT = (
    f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
DATABASE_URL = os.environ.get("DATABASE_URL", DATABASE_URL_DEFAULT)
DATABASE_URL_SYNC = DATABASE_URL.replace("+asyncpg", "")


class SessionManager:
    def __init__(self, host: str, engine_kwargs: dict[str, Any] = {}):
        self._engine = create_async_engine(host, **engine_kwargs)
        self._sessionmaker = async_sessionmaker(
            autocommit=False, autoflush=False, bind=self._engine, expire_on_commit=False
        )

    async def _close(self):
        if self._engine is None:
            raise Exception("SessionManager already closed")
        await self._engine.dispose()

        self._engine = None
        self._sessionmaker = None

    @contextlib.asynccontextmanager
    async def connect(self) -> AsyncIterator[AsyncConnection]:
        if self._engine is None:
            raise Exception("SessionManager already closed")

        async with self._engine.connect() as conn:
            try:
                yield conn
                await conn.commit()
            except Exception:
                await conn.rollback()
                raise

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        if self._engine is None:
            raise Exception("SessionManager already closed")

        async with self._sessionmaker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()


# --------------------------------------------------------------------------------------------------------------------------------
# Session and engine management
# --------------------------------------------------------------------------------------------------------------------------------

engine_args: dict[str, Any] = {
    "pool_size": 10,
    "pool_pre_ping": True,
    "max_overflow": 30,
    "echo": False,  # this is default, but keep explicit as when debugging often set to true
}
if os.environ.get("USE_SSL", "false").lower() == "true":
    engine_args["connect_args"] = {"ssl": "require"}

sessionmanager = SessionManager(DATABASE_URL, engine_kwargs=engine_args)


async def get_db_session():
    async with sessionmanager.session() as session:
        yield session


DBSessionDep = Annotated[AsyncSession, Depends(get_db_session)]
