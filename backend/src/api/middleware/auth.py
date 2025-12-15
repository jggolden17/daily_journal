import uuid
from typing import Optional, Annotated
from api.services.core.users import UsersService
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.db.database import DBSessionDep
from api.db.models.core.users import UsersModel
from api.api_schemas.core.users import UserSchema
from api.services.core.auth import verify_access_token
from api.utils.cookies import get_access_token_from_cookie
from api.utils.logger import log

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    session: DBSessionDep,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UsersModel:
    """get current authenticated user from JWT"""

    token = get_access_token_from_cookie(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_data = verify_access_token(token)

        user_id = uuid.UUID(token_data.sub)

        user = await UsersService(session).get_one_or_none_by_id(user_id)

        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return user

    except Exception as e:

        if isinstance(e, ValueError):
            log.warning(f"Token verification failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            log.error(f"Unexpected error in authentication: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed",
                headers={"WWW-Authenticate": "Bearer"},
            )


async def get_optional_user(
    request: Request,
    session: DBSessionDep,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[UsersModel]:
    """
    optionally get the current authenticated user.
    Returns None if no token is provided or token is invalid.
    """
    token = get_access_token_from_cookie(request)

    if not token:
        return None

    try:
        return await get_current_user(request, session, credentials)
    except HTTPException:
        return None


# Type alias for dependency injection
CurrentUser = Annotated[UsersModel, Depends(get_current_user)]
OptionalUser = Annotated[Optional[UsersModel], Depends(get_optional_user)]
