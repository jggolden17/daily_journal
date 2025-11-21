import datetime as dt
import uuid
from typing import Optional
from pydantic import BaseModel


class ThreadSchema(BaseModel):
    """Response schema for thread data"""

    id: uuid.UUID
    user_id: uuid.UUID
    date: dt.date
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:

        from_attributes = True


class ThreadCreateSchema(BaseModel):
    """Schema for creating a new thread"""

    user_id: uuid.UUID
    date: dt.date


class ThreadUpdateSchema(BaseModel):
    """Schema for full thread update"""

    user_id: uuid.UUID
    date: dt.date


class ThreadPatchSchema(BaseModel):
    """Schema for partial thread update"""

    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    date: Optional[dt.date] = None


class ThreadUpsertSchema(BaseModel):
    """Schema for upsert operations - checks for existing record by (user_id, date)"""

    user_id: uuid.UUID
    date: dt.date
