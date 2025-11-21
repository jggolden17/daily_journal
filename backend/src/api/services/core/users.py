import datetime as dt
from api.db.base_data_manager import BaseDataManager
from api.db.models.core.users import UsersModel
from api.api_schemas.core.users import (
    UserCreateSchema,
    UserPatchSchema,
)
from api.services.base_service import (
    BaseService,
)
from sqlalchemy.ext.asyncio import AsyncSession


def populate_create_model(
    schema: UserCreateSchema,
    current_time: dt.datetime,
):
    schema_dict = schema.model_dump()
    schema_dict.update(
        {
            "created_at": current_time,
            "updated_at": current_time,
        }
    )

    return UsersModel(**schema_dict)


class UsersService(
    BaseService[
        BaseDataManager[UsersModel],
        UsersModel,
        UserCreateSchema,
        UserPatchSchema,
    ]
):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(
            session,
            data_manager=BaseDataManager,
            model=UsersModel,
            create_schema=UserCreateSchema,
            patch_schema=UserPatchSchema,
            to_create_model=populate_create_model,
        )
