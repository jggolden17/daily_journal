from fastapi import APIRouter, status, HTTPException
from sqlalchemy import text
from api.db.database import sessionmanager

router = APIRouter()


@router.get("/health", tags=["Healthcheck"])
async def healthcheck():
    """
    health check endpoint.
    returns service status and database connectivity.

    Returns:
        - 200 OK: Service and database are healthy
        - 503 Service Unavailable: Service is unhealthy (DB disconnected or other issues)
    """
    health_status = {
        "status": "healthy",
        "service": "daily-journal-api",
        "database": "unknown",
    }

    # check db connectivity
    try:
        async with sessionmanager.session() as session:
            result = await session.execute(text("SELECT 1"))
            result.scalar()
            health_status["database"] = "connected"
    except Exception as e:
        health_status["database"] = "disconnected"
        health_status["database_error"] = str(e)
        health_status["status"] = "unhealthy"
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=health_status
        )

    return health_status
