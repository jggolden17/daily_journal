import datetime as dt
import uuid
from typing import Optional
from pydantic import BaseModel, Field


class EntrySchema(BaseModel):
    """Response schema for entry data"""

    id: uuid.UUID
    thread_id: uuid.UUID
    raw_markdown: str | None
    written_at: dt.datetime
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:

        from_attributes = True


class EntryWithDateSchema(EntrySchema):
    """Response schema for entry data with date from thread"""

    date: dt.date  # Date from the thread

    class Config:

        from_attributes = True


class EntryCreateSchema(BaseModel):
    """Schema for creating a new entry"""

    thread_id: uuid.UUID
    raw_markdown: Optional[str] = None


class EntryCreateWithDateSchema(BaseModel):
    """Schema for creating a new entry with date and user_id (will upsert thread)"""

    user_id: uuid.UUID
    date: dt.date
    raw_markdown: Optional[str] = None


class EntryUpdateSchema(BaseModel):
    """Schema for full entry update"""

    thread_id: uuid.UUID
    raw_markdown: Optional[str] = None
    written_at: Optional[dt.datetime] = None


class EntryPatchSchema(BaseModel):
    """Schema for partial entry update"""

    id: uuid.UUID
    thread_id: Optional[uuid.UUID] = None
    raw_markdown: Optional[str] = None
    written_at: Optional[dt.datetime] = None


class EncryptedPatchSchema(EntryPatchSchema):
    """Schema for patching entries with encrypted markdown (internal use only)"""

    encrypted_markdown: Optional[str] = None
    written_at: Optional[dt.datetime] = None


class CalendarEntrySchema(BaseModel):
    """Schema for calendar entry data"""

    date: dt.date
    has_entry: bool = Field(serialization_alias="hasEntry")
    has_metrics: bool = Field(serialization_alias="hasMetrics", default=False)
    has_sleep_metrics: bool = Field(serialization_alias="hasSleepMetrics", default=False)
    has_complete_metrics: bool = Field(serialization_alias="hasCompleteMetrics", default=False)

    class Config:
        # Allow both alias and field name for serialization/deserialization
        populate_by_name = True
