"""Cookie utility functions for authentication."""

from typing import Literal
from fastapi import Request, Response
from starlette.responses import Response as StarletteResponse

from api import COOKIE_SECURE, COOKIE_SAME_SITE


# Cookie names
ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"
CSRF_TOKEN_COOKIE = "csrf_token"

# Cookie settings
COOKIE_PATH = "/api"
COOKIE_HTTP_ONLY = True


def set_auth_cookies(
    response: Response | StarletteResponse,
    access_token: str,
    refresh_token: str,
    access_token_max_age: int = 15 * 60,
    refresh_token_max_age: int = 7 * 24 * 60 * 60,
) -> None:
    """
    set access_token and refresh_token as HttpOnly cookies.

    Args:
        response: FastAPI Response object
        access_token: JWT access token
        refresh_token: Refresh token string
        access_token_max_age: Max age for access token cookie in seconds
        refresh_token_max_age: Max age for refresh token cookie in seconds
    """

    samesite: Literal["lax", "strict", "none"] | None = None
    if COOKIE_SAME_SITE in ("lax", "strict", "none"):
        samesite = COOKIE_SAME_SITE  # type: ignore[assignment]

    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        max_age=access_token_max_age,
        path=COOKIE_PATH,
        httponly=COOKIE_HTTP_ONLY,
        secure=COOKIE_SECURE,
        samesite=samesite,
    )

    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        max_age=refresh_token_max_age,
        path=COOKIE_PATH,
        httponly=COOKIE_HTTP_ONLY,
        secure=COOKIE_SECURE,
        samesite=samesite,
    )


def clear_auth_cookies(response: Response | StarletteResponse) -> None:
    """set access_token and refresh_token to expire immediately."""

    samesite: Literal["lax", "strict", "none"] | None = None
    if COOKIE_SAME_SITE in ("lax", "strict", "none"):
        samesite = COOKIE_SAME_SITE  # type: ignore[assignment]

    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value="",
        max_age=0,
        path=COOKIE_PATH,
        httponly=COOKIE_HTTP_ONLY,
        secure=COOKIE_SECURE,
        samesite=samesite,
    )

    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value="",
        max_age=0,
        path=COOKIE_PATH,
        httponly=COOKIE_HTTP_ONLY,
        secure=COOKIE_SECURE,
        samesite=samesite,
    )


def _get_token_from_cookie(request: Request, cookie_name: str) -> str | None:
    return request.cookies.get(cookie_name)


def get_access_token_from_cookie(request: Request) -> str | None:
    return _get_token_from_cookie(request, ACCESS_TOKEN_COOKIE)


def get_refresh_token_from_cookie(request: Request) -> str | None:
    return _get_token_from_cookie(request, REFRESH_TOKEN_COOKIE)
