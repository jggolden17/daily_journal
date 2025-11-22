from api.api_schemas.journal.metrics import (
    MetricCreateSchema,
    MetricPatchSchema,
    MetricSchema,
    MetricUpsertSchema,
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
from api.routes.route_prefix import METRICS_URL
from api.routes.route_types import OptionalUUIDList, RequiredUUIDList
from api.services.journal.metrics import MetricsService
from api.utils.utils import (
    create_paged_response,
    create_response,
    validate_page_params,
    validate_sort_params,
)
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/" + METRICS_URL)


@router.get("", response_model=PaginatedResponse[MetricSchema])
async def get_data(
    session: DBSessionDep,
    current_user: CurrentUser,
    ids: OptionalUUIDList = None,
    page_params: PageParams = Depends(validate_page_params),
    sort_params: SortParams = Depends(validate_sort_params),
) -> PaginatedResponse[list[MetricSchema]]:
    """get (with pagination)"""
    try:
        data, total_records = await MetricsService(session).get_all_paginated(
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


@router.post("", response_model=SingleItemResponse[list[MetricSchema]])
async def create_data(
    metrics: list[MetricCreateSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[MetricSchema]]:
    """create"""
    try:
        data = await MetricsService(session).create(schemas=metrics)
        return create_response(data)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )


@router.patch("", response_model=SingleItemResponse[list[MetricSchema]])
async def update_data(
    metrics: list[MetricPatchSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[MetricSchema]]:
    """update"""
    try:
        data = await MetricsService(session).patch(schemas=metrics)
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


@router.post("/upsert", response_model=SingleItemResponse[list[MetricSchema]])
async def upsert_data(
    metrics: list[MetricUpsertSchema],
    session: DBSessionDep,
    current_user: CurrentUser,
) -> SingleItemResponse[list[MetricSchema]]:
    """upsert"""
    try:
        data = await MetricsService(session).upsert(
            schemas=metrics,
            unique_constr_cols=("thread_id",),
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
        await MetricsService(session).delete(ids=ids)
    except DataValidationError as e:
        raise HTTPException(
            status_code=e.code,
            detail={"error": "Data validation error", "message": str(e)},
        )
