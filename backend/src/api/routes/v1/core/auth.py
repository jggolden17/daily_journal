import datetime as dt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.api_schemas.core.auth import GoogleLoginRequest, AuthResponse
from api.api_schemas.core.users import UserPatchSchema, UserSchema, UserUpsertSchema
from api.api_schemas.generic import SingleItemResponse
from api.db.database import DBSessionDep
from api.db.models.core.users import UsersModel
from api.middleware.auth import CurrentUser
from api.services.core.auth import verify_google_token, create_access_token
from api.services.core.users import UsersService
from api.utils.utils import create_response
from api.utils.logger import log

router = APIRouter(prefix="/auth")


@router.post("/google", response_model=SingleItemResponse[AuthResponse])
async def login_with_google(
    request: GoogleLoginRequest,
    session: DBSessionDep,
) -> SingleItemResponse[AuthResponse]:
    """
    authenticate user with Google ID token.
    creates a new user if they don't exist, or updates existing user.
    returns JWT & user info.
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
        auth_response = AuthResponse(
            access_token=access_token,
            user=user_schema,
        )
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


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    current_user: CurrentUser,
) -> None:
    """
    Logout endpoint.
    TODO:
        - In a stateless JWT system, logout is primarily handled client-side by removing the token. This endpoint exists for consistency and potential future token blacklisting.
    """
    # For now, just return success. Client should remove token.
    # Future: Could implement token blacklist here if needed.
    return None
