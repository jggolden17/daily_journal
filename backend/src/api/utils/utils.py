from math import ceil
from typing import Annotated
from fastapi import HTTPException, Query
from api.api_schemas.generic import (
    DataResponse,
    PageParams,
    PaginatedResponse,
    SingleItemResponse,
    SortParams,
)


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
