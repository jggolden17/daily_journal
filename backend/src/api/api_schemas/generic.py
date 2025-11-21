"""pydantic models for generic endpoint responses"""

from typing import Generic, TypeVar
from typing_extensions import Annotated
from pydantic import BaseModel, Field

DataResponse = TypeVar("DataResponse")


class PageParams(BaseModel):
    """request query params for paginated API"""

    current_page: Annotated[int, Field(strict=True, ge=1)] = 1
    page_size: Annotated[int, Field(strict=True, ge=1, le=10000)] = 100


class SortParams(BaseModel):
    """sort params for paginated API."""

    sort_by: str = "id"
    sort_direction: str = "asc"


class PaginatedResponse(BaseModel, Generic[DataResponse]):
    """simple wrapper around generic paginated response"""

    current_page: int
    page_size: int
    total_records: int
    total_pages: int
    sort_by: str
    sort_direction: str
    data: list[DataResponse] | None


class SingleItemResponse(BaseModel, Generic[DataResponse]):
    """simple wrapper around generic single item response"""

    data: DataResponse | None
