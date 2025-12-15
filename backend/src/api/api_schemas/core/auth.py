from pydantic import BaseModel

from api.api_schemas.core.users import UserSchema


class GoogleLoginRequest(BaseModel):
    """Request schema for Google login"""

    id_token: str


class AuthResponse(BaseModel):
    """Response schema for authentication.
    (tokens set as HttpOnly cookies, not returned in response body)
    """

    user: UserSchema


class TokenData(BaseModel):
    """Internal schema for JWT token payload"""

    sub: str  # user_id as string
    exp: int  # expiration unix timestamp
    iat: int  # issued at timestamp (int bc unix)
