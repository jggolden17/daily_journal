import datetime as dt
import uuid
from typing import Optional
from pydantic import BaseModel, Field


class MetricSchema(BaseModel):
    """Response schema for metric data"""

    id: uuid.UUID
    thread_id: uuid.UUID
    asleep_by: dt.datetime | None
    awoke_at: dt.datetime | None
    out_of_bed_at: dt.datetime | None
    sleep_quality: int | None
    physical_activity: int | None
    overall_mood: int | None
    paid_productivity: float | None
    personal_productivity: float | None
    additional_metrics: dict | None
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:

        from_attributes = True


class MetricCreateSchema(BaseModel):
    """Schema for creating a new metric"""

    thread_id: uuid.UUID
    asleep_by: Optional[dt.datetime] = None
    awoke_at: Optional[dt.datetime] = None
    out_of_bed_at: Optional[dt.datetime] = None
    sleep_quality: Optional[int] = Field(None, ge=1, le=7)
    physical_activity: Optional[int] = Field(None, ge=1, le=7)
    overall_mood: Optional[int] = Field(None, ge=1, le=7)
    paid_productivity: Optional[float] = None
    personal_productivity: Optional[float] = None
    additional_metrics: Optional[dict] = None


class MetricUpdateSchema(BaseModel):
    """Schema for full metric update"""

    thread_id: uuid.UUID
    asleep_by: Optional[dt.datetime] = None
    awoke_at: Optional[dt.datetime] = None
    out_of_bed_at: Optional[dt.datetime] = None
    sleep_quality: Optional[int] = Field(None, ge=1, le=7)
    physical_activity: Optional[int] = Field(None, ge=1, le=7)
    overall_mood: Optional[int] = Field(None, ge=1, le=7)
    paid_productivity: Optional[float] = None
    personal_productivity: Optional[float] = None
    additional_metrics: Optional[dict] = None


class MetricPatchSchema(BaseModel):
    """Schema for partial metric update"""

    id: uuid.UUID
    thread_id: Optional[uuid.UUID] = None
    asleep_by: Optional[dt.datetime] = None
    awoke_at: Optional[dt.datetime] = None
    out_of_bed_at: Optional[dt.datetime] = None
    sleep_quality: Optional[int] = Field(None, ge=1, le=7)
    physical_activity: Optional[int] = Field(None, ge=1, le=7)
    overall_mood: Optional[int] = Field(None, ge=1, le=7)
    paid_productivity: Optional[float] = None
    personal_productivity: Optional[float] = None
    additional_metrics: Optional[dict] = None


class MetricUpsertSchema(BaseModel):
    """Schema for upsert operations - checks for existing record by thread_id"""

    thread_id: uuid.UUID
    asleep_by: Optional[dt.datetime] = None
    awoke_at: Optional[dt.datetime] = None
    out_of_bed_at: Optional[dt.datetime] = None
    sleep_quality: Optional[int] = Field(None, ge=1, le=7)
    physical_activity: Optional[int] = Field(None, ge=1, le=7)
    overall_mood: Optional[int] = Field(None, ge=1, le=7)
    paid_productivity: Optional[float] = None
    personal_productivity: Optional[float] = None
    additional_metrics: Optional[dict] = None
