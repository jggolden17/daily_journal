import datetime as dt
import uuid
from typing import Optional
from pydantic import BaseModel, EmailStr


class UserSchema(BaseModel):
    """Response schema for user data"""

    id: uuid.UUID
    email: str
    external_auth_sub: str
    name: str | None
    picture: str | None
    last_login_at: dt.datetime | None
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:

        from_attributes = True


class UserCreateSchema(BaseModel):
    """Schema for creating a new user"""

    email: EmailStr
    external_auth_sub: str
    name: Optional[str] = None
    picture: Optional[str] = None


class UserUpdateSchema(BaseModel):
    """Schema for full user update"""

    id: uuid.UUID
    email: EmailStr
    external_auth_sub: str
    last_login_at: Optional[dt.datetime] = None


class UserPatchSchema(BaseModel):
    """Schema for partial user update"""

    id: uuid.UUID
    email: Optional[EmailStr] = None
    external_auth_sub: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None
    last_login_at: Optional[dt.datetime] = None


class UserUpsertSchema(BaseModel):
    """Schema for upsert operations - checks for existing record by email"""

    email: EmailStr
    external_auth_sub: str
    name: Optional[str] = None
    picture: Optional[str] = None
    last_login_at: Optional[dt.datetime] = None
