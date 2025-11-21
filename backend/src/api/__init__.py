"""Init for api"""

import os
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", "5432"))
DB_USER = os.environ.get("DB_USER", "localDbUser")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "localDbPassword")
DB_NAME = os.environ.get("DB_NAME", "journal_db")

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")