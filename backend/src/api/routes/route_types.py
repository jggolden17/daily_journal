"""Shared type aliases for route query parameters."""

from typing import Annotated
from fastapi import Query
import uuid

# type aliases for cleaner route parameter definitions
OptionalUUIDList = Annotated[list[uuid.UUID] | None, Query()]
RequiredUUIDList = Annotated[list[uuid.UUID], Query()]
