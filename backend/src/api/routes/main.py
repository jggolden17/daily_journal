import contextlib
from fastapi import APIRouter, FastAPI
from starlette.middleware.gzip import GZipMiddleware
from api.db.database import sessionmanager
from api.routes import healthcheck
from api.routes.route_metadata import tags_metadata
from api.routes.route_prefix import JOURNAL_API_TITLE, OPEN_API_DESCRIPTION
from api.routes.v1.core import users
from api.routes.v1.journal import entries, metrics, threads
from api.utils.logger import log


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    """application lifespan context manager."""
    yield
    if sessionmanager._engine is not None:
        await sessionmanager._close()


API_VERSION = "v1"

app = FastAPI(
    title=JOURNAL_API_TITLE,
    description=OPEN_API_DESCRIPTION,
    version=API_VERSION,
    swagger_ui_parameters={"defaultModelsExpandDepth": -1},
    openapi_tags=tags_metadata,
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware)


# root-level routes
app.include_router(healthcheck.router)

api_router = APIRouter(prefix="/api")

# versioned routes
v1_router = APIRouter(prefix=f"/{API_VERSION}")
v1_router.include_router(users.router, tags=["Users"], include_in_schema=False)
v1_router.include_router(entries.router, tags=["Entries"], include_in_schema=False)
v1_router.include_router(metrics.router, tags=["Metrics"], include_in_schema=False)
v1_router.include_router(threads.router, tags=["Threads"], include_in_schema=False)
api_router.include_router(v1_router)

# latest routes
latest_router = APIRouter(prefix="/latest")
latest_router.include_router(users.router, tags=["Users"])
latest_router.include_router(entries.router, tags=["Entries"])
latest_router.include_router(metrics.router, tags=["Metrics"])
latest_router.include_router(threads.router, tags=["Threads"])
api_router.include_router(latest_router)

# Include the API router in the main app
app.include_router(api_router)
