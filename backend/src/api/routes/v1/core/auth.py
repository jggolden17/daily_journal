import datetime as dt
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_schemas.core.auth import GoogleLoginRequest, AuthResponse
from api.api_schemas.core.users import UserPatchSchema, UserSchema, UserUpsertSchema
from api.api_schemas.generic import SingleItemResponse
from api.db.database import DBSessionDep
from api.db.models.core.users import UsersModel
from api.middleware.auth import CurrentUser
from api.services.core.auth import (
    verify_google_token,
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    verify_refresh_token,
)
from api.services.core.users import UsersService
from api.services.core.refresh_tokens import RefreshTokensService
from api.utils.utils import create_response
from api.utils.cookies import (
    set_auth_cookies,
    clear_auth_cookies,
    get_refresh_token_from_cookie,
    ACCESS_TOKEN_COOKIE,
)
from api.utils.logger import log
from api import JWT_ACCESS_TOKEN_EXPIRE_MINUTES, JWT_REFRESH_TOKEN_EXPIRE_DAYS

router = APIRouter(prefix="/auth")


@router.post("/google", response_model=SingleItemResponse[AuthResponse])
async def login_with_google(
    request: GoogleLoginRequest,
    response: Response,
    session: DBSessionDep,
) -> SingleItemResponse[AuthResponse]:
    """
    authenticate user with Google ID token.
    creates a new user if they don't exist, or updates existing user.
    sets access_token and refresh_token as HttpOnly cookies.
    """
    try:
        google_user_info = verify_google_token(request.id_token)

        # Find or create user
        user_service = UsersService(session)
        existing_user = await user_service.get_one_or_none(
            "external_auth_sub", google_user_info["sub"]
        )
        if existing_user:
            update_fields = {}
            for field in ["email", "name", "picture"]:
                field_value = google_user_info.get(field)
                update_fields[field] = (
                    field_value if field_value else getattr(existing_user, field)
                )
            user_nested = await user_service.patch(
                schemas=[
                    UserPatchSchema(
                        id=existing_user.id,
                        last_login_at=dt.datetime.now(dt.timezone.utc),
                        **update_fields,
                    )
                ],
            )
            user = user_nested[0]
        else:
            email = google_user_info["email"]
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email is required",
                )
            user_upsert_schema = UserUpsertSchema(
                email=email,
                external_auth_sub=google_user_info["sub"],
                name=google_user_info.get("name"),
                picture=google_user_info.get("picture"),
                last_login_at=dt.datetime.now(dt.timezone.utc),
            )
            user_nested = await user_service.upsert(
                schemas=[user_upsert_schema],
                unique_constr_cols=("email", "external_auth_sub"),
                blocked_update_fields=["id", "created_at"],
            )
            user = user_nested[0]
        user_schema = UserSchema.model_validate(user)

        access_token = create_access_token(user.id)

        refresh_token = create_refresh_token()
        token_hash = hash_refresh_token(refresh_token)
        refresh_token_service = RefreshTokensService(session)
        await refresh_token_service.create_refresh_token_record(
            user_id=user.id,
            token_hash=token_hash,
        )

        # set cookies
        access_token_max_age = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        refresh_token_max_age = JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        set_auth_cookies(
            response,
            access_token,
            refresh_token,
            access_token_max_age=access_token_max_age,
            refresh_token_max_age=refresh_token_max_age,
        )

        # Return user info only (tokens in cookies)
        auth_response = AuthResponse(user=user_schema)
        return create_response(auth_response)

    except Exception as e:
        if isinstance(e, ValueError):
            log.warning(f"Google authentication failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Authentication failed: {str(e)}",
            )
        else:
            log.error(f"Unexpected error during Google login: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error during authentication",
            )


@router.get("/me", response_model=SingleItemResponse[UserSchema])
async def get_current_user_info(
    current_user: CurrentUser,
) -> SingleItemResponse[UserSchema]:
    """get current authenticated user info"""
    user_schema = UserSchema.model_validate(current_user)
    return create_response(user_schema)


@router.post("/refresh", response_model=SingleItemResponse[UserSchema])
async def refresh_token(
    request: Request,
    response: Response,
    session: DBSessionDep,
) -> SingleItemResponse[UserSchema]:
    """
    Issues new access token and optionally rotates refresh token
    """
    refresh_token_str = get_refresh_token_from_cookie(request)

    if not refresh_token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token not found",
        )

    try:
        token_hash = hash_refresh_token(refresh_token_str)
        refresh_token_service = RefreshTokensService(session)
        refresh_token_record = await refresh_token_service.get_refresh_token_by_hash(
            token_hash
        )

        if not refresh_token_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired refresh token",
            )

        user_service = UsersService(session)
        user = await user_service.get_one_or_none_by_id(
            uuid.UUID(str(refresh_token_record.user_id))
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )

        await refresh_token_service.revoke_refresh_token(refresh_token_record.id)
        access_token = create_access_token(user.id)
        new_refresh_token = create_refresh_token()
        new_token_hash = hash_refresh_token(new_refresh_token)

        await refresh_token_service.create_refresh_token_record(
            user_id=user.id,
            token_hash=new_token_hash,
        )

        access_token_max_age = JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
        refresh_token_max_age = JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
        set_auth_cookies(
            response,
            access_token,
            new_refresh_token,
            access_token_max_age=access_token_max_age,
            refresh_token_max_age=refresh_token_max_age,
        )

        user_schema = UserSchema.model_validate(user)
        return create_response(user_schema)

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Unexpected error during token refresh: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during token refresh",
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    current_user: CurrentUser,
    session: DBSessionDep,
) -> None:
    """
    Logout endpoint. Revokes refresh token from database and clears auth cookies
    """
    refresh_token_service = RefreshTokensService(session)
    await refresh_token_service.revoke_all_user_tokens(current_user.id)

    clear_auth_cookies(response)

    return None
