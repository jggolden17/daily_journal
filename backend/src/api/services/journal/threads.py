import datetime as dt
from api.db.base_data_manager import BaseDataManager
from api.db.models.journal.threads import ThreadsModel
from api.api_schemas.journal.threads import (
    ThreadCreateSchema,
    ThreadPatchSchema,
)
from api.services.base_service import BaseService
from sqlalchemy.ext.asyncio import AsyncSession


def populate_create_model(
    schema: ThreadCreateSchema,
    current_time: dt.datetime,
):
    """convert ThreadCreateSchema to ThreadsModel instance."""
    schema_dict = schema.model_dump()
    schema_dict.update(
        {
            "created_at": current_time,
            "updated_at": current_time,
        }
    )

    return ThreadsModel(**schema_dict)


class ThreadsService(
    BaseService[
        BaseDataManager[ThreadsModel],
        ThreadsModel,
        ThreadCreateSchema,
        ThreadPatchSchema,
    ]
):
    """Service for managing journal threads."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            session,
            data_manager=BaseDataManager,
            model=ThreadsModel,
            create_schema=ThreadCreateSchema,
            patch_schema=ThreadPatchSchema,
            to_create_model=populate_create_model,
        )
