from pydantic import BaseModel

from api.api_schemas.core.users import UserSchema


class GoogleLoginRequest(BaseModel):
    """Request schema for Google login"""

    id_token: str


class AuthResponse(BaseModel):
    """Response schema for authentication"""

    access_token: str
    user: UserSchema


class TokenData(BaseModel):
    """Internal schema for JWT token payload"""

    sub: str  # user_id as string
    exp: int  # expiration unix timestamp
    iat: int  # issued at timestamp (int bc unix)
