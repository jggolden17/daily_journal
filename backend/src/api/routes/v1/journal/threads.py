from api.api_schemas.journal.threads import (
    ThreadCreateSchema,
    ThreadPatchSchema,
    ThreadSchema,
    ThreadUpsertSchema,
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
from api.routes.route_prefix import THREADS_URL
from api.routes.route_types import OptionalUUIDList, RequiredUUIDList
from api.services.journal.threads import ThreadsService
from api.utils.utils import (
    create_paged_response,
    create_response,
    validate_page_params,
    validate_sort_params,
    validate_user_ids_authorization,
)
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/" + THREADS_URL)


@router.get("", response_model=PaginatedResponse[ThreadSchema])
async def get_data(
    session: DBSessionDep,
    current_user: CurrentUser,
    ids: OptionalUUIDList = None,
    page_params: PageParams = Depends(validate_page_params),
    sort_params: SortParams = Depends(validate_sort_params),
) -> PaginatedResponse[list[ThreadSchema]]:
    """get (with pagination)"""
    try:
        data, total_records = await ThreadsService(session).get_all_paginated(
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


@router.post("", response_model=SingleItemResponse[list[ThreadSchema]])
async def create_data(
    threads: list[ThreadCreateSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[ThreadSchema]]:
    """create"""
    validate_user_ids_authorization([t.user_id for t in threads], current_user)
    try:
        data = await ThreadsService(session).create(schemas=threads)
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.patch("", response_model=SingleItemResponse[list[ThreadSchema]])
async def update_data(
    threads: list[ThreadPatchSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[ThreadSchema]]:
    """update"""
    # Validate user_id if provided (it's optional in PatchSchema)
    user_ids = [t.user_id for t in threads if t.user_id is not None]
    if user_ids:
        validate_user_ids_authorization(user_ids, current_user)
    try:
        data = await ThreadsService(session).patch(schemas=threads)
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


@router.post("/upsert", response_model=SingleItemResponse[list[ThreadSchema]])
async def upsert_data(
    threads: list[ThreadUpsertSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[ThreadSchema]]:
    """upsert"""
    validate_user_ids_authorization([t.user_id for t in threads], current_user)
    try:
        data = await ThreadsService(session).upsert(
            schemas=threads,
            unique_constr_cols=("user_id", "date"),
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
        await ThreadsService(session).delete(ids=ids)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
