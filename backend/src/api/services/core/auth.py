import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from google.auth.transport import requests
from google.oauth2 import id_token
from jose import JWTError, jwt
from pydantic import ValidationError

from api import (
    GOOGLE_CLIENT_ID,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
    is_local_environment,
    MOCK_GOOGLE_ID_TOKEN,
)
from api.api_schemas.core.auth import TokenData


def verify_google_token(id_token_str: str) -> dict:
    # in local dev, don't go via google
    if is_local_environment() and id_token_str == MOCK_GOOGLE_ID_TOKEN:
        return {
            "sub": "mock-dev-user-123",
            "email": "dev@localhost.com",
            "name": "Dev User",
            "picture": None,
        }

    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID not configured")

    try:
        # verify token & issuer
        idinfo = id_token.verify_oauth2_token(
            id_token_str, requests.Request(), GOOGLE_CLIENT_ID
        )
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Wrong issuer")

        return {
            "sub": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name", ""),
            "picture": idinfo.get("picture"),
        }
    except ValueError as e:
        raise ValueError(f"Invalid Google token: {str(e)}")


def create_access_token(user_id: uuid.UUID) -> str:

    if not JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY not configured")

    expire = datetime.now(timezone.utc) + timedelta(
        minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload = {
        "sub": str(user_id),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }

    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_access_token(token: str) -> TokenData:

    if not JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY not configured")

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        token_data = TokenData.model_validate(payload)
        return token_data
    except JWTError as e:
        raise ValueError(f"Invalid token: {str(e)}")
    except ValidationError as e:
        raise ValueError(f"Invalid token payload structure: {str(e)}")
