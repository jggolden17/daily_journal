import uuid
from math import ceil
from typing import Annotated
from fastapi import HTTPException, Query, status
from api.api_schemas.generic import (
    DataResponse,
    PageParams,
    PaginatedResponse,
    SingleItemResponse,
    SortParams,
)
from api.db.models.core.users import UsersModel


def validate_page_params(
    current_page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=10000)] = 100,
) -> PageParams:
    """validate valid page params passed"""
    if page_size > 10000:
        raise HTTPException(
            status_code=404, detail=f"page_size must be <10000, not: {page_size}"
        )
    return PageParams(current_page=current_page, page_size=page_size)


def validate_sort_params(
    sort_by: Annotated[str, Query()] = "id",
    sort_direction: Annotated[str, Query()] = "asc",
) -> SortParams:
    """validate valid sort params passed"""
    if sort_direction not in ["asc", "desc"]:
        raise HTTPException(
            status_code=404,
            detail=f"sort_direction must be 'asc' or 'desc', not: {sort_direction}",
        )
    return SortParams(sort_by=sort_by, sort_direction=sort_direction)


def create_response(data: DataResponse) -> SingleItemResponse:
    """given data create single item response"""
    return SingleItemResponse(data=data)


def create_paged_response(
    page_params: PageParams,
    sort_params: SortParams,
    total_records: int,
    data: list[DataResponse],
) -> PaginatedResponse:
    """given data and page params creates paginated response"""
    return PaginatedResponse(
        current_page=page_params.current_page,
        page_size=page_params.page_size,
        total_records=total_records,
        total_pages=ceil(total_records / page_params.page_size),
        sort_by=sort_params.sort_by,
        sort_direction=sort_params.sort_direction,
        data=data,
    )


def validate_user_id_authorization(
    user_id: uuid.UUID,
    current_user: UsersModel,
) -> None:
    """prevent an authenticated user getting an alt user's data"""
    if user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access or modify other users' data",
        )


def validate_user_ids_authorization(
    user_ids: list[uuid.UUID],
    current_user: UsersModel,
) -> None:
    """prevent an authenticated user getting an alt user's data"""
    if not all(user_id == current_user.id for user_id in user_ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot access or modify other users' data",
        )
