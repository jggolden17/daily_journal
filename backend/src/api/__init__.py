"""Init for api"""

import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_USER = os.environ.get("DB_USER", "localDbUser")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "localDbPassword")
DB_NAME = os.environ.get("DB_NAME", "journal_db")

CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
    if origin.strip()
]

# auth config
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "")
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

# encryption config
ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")


def is_local_environment() -> bool:
    """go through diff auth route if in local mode. Using func as may have >1 check"""

    if os.environ.get("ENVIRONMENT", "").lower() == "local":
        return True

    return False


MOCK_GOOGLE_ID_TOKEN = "mock-google-id-token-dev"
