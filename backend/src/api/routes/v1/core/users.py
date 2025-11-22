from api.api_schemas.core.users import (
    UserCreateSchema,
    UserPatchSchema,
    UserSchema,
    UserUpsertSchema,
)
from api.api_schemas.generic import (
    PageParams,
    PaginatedResponse,
    SingleItemResponse,
    SortParams,
)
from api.db.base_data_manager import DataValidationError
from api.db.database import DBSessionDep
from api.middleware.auth import CurrentUser
from api.routes.route_prefix import USERS_URL
from api.routes.route_types import OptionalUUIDList, RequiredUUIDList
from api.services.core.users import UsersService
from api.utils.utils import (
    create_paged_response,
    create_response,
    validate_page_params,
    validate_sort_params,
)
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/" + USERS_URL)


@router.get("", response_model=PaginatedResponse[UserSchema])
async def get_data(
    session: DBSessionDep,
    current_user: CurrentUser,
    ids: OptionalUUIDList = None,
    page_params: PageParams = Depends(validate_page_params),
    sort_params: SortParams = Depends(validate_sort_params),
) -> PaginatedResponse[list[UserSchema]]:
    """get (with pagination)"""
    try:
        data, total_records = await UsersService(session).get_all_paginated(
            ids,
            page_params,
            sort_params,
        )
        return create_paged_response(page_params, sort_params, total_records, data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.post("", response_model=SingleItemResponse[list[UserSchema]])
async def create_data(
    users: list[UserCreateSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[UserSchema]]:
    """create"""
    try:
        data = await UsersService(session).create(schemas=users)
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.patch("", response_model=SingleItemResponse[list[UserSchema]])
async def update_data(
    users: list[UserPatchSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[UserSchema]]:
    """update"""
    try:
        data = await UsersService(session).patch(schemas=users)
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.post("/upsert", response_model=SingleItemResponse[list[UserSchema]])
async def upsert_data(
    users: list[UserUpsertSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[UserSchema]]:
    """upsert"""
    try:
        data = await UsersService(session).upsert(
            schemas=users,
            unique_constr_cols=("email", "external_auth_sub"),
            blocked_update_fields=["id", "created_at"],
        )
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "Internal server error", "message": str(e)},
        )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_data(
    ids: RequiredUUIDList,
    session: DBSessionDep,
    current_user: CurrentUser,
) -> None:
    """delete"""
    try:
        await UsersService(session).delete(ids=ids)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
