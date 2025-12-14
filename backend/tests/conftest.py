"""
pytest configuration and shared fixtures for testing the FastAPI backend.
- pytest fixtures are used to setup and tear down the test environment
- before any tests are run:
  - set up dedicated test database
  - run migrations
  - start dedicated test API server
  - wait for API server to be ready
- after all tests are run:
  - stop test API server
  - drop test database
- test data is loaded from the test_data directory
- before/after each test fixtures run that create/delete test data required for the test
  - e.g. to satisfy fk constraints
"""

import os
import sys
from pathlib import Path
from typing import Generator
import json
import subprocess
import time
import atexit
import uuid

import pytest
import httpx
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# JWT config before importing api modules so __init__ reads test vals
TEST_JWT_SECRET_KEY = os.environ.get(
    "JWT_SECRET_KEY", "test-secret-key-for-jwt-tokens-do-not-use-in-production"
)
os.environ["JWT_SECRET_KEY"] = TEST_JWT_SECRET_KEY
os.environ["JWT_ALGORITHM"] = os.environ.get("JWT_ALGORITHM", "HS256")
os.environ["JWT_ACCESS_TOKEN_EXPIRE_MINUTES"] = os.environ.get(
    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"
)

# add src directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from api.utils.logger import log
from api import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME  # noqa: E402
from api.services.core.auth import create_access_token  # noqa: E402
from api.db.models.core.users import UsersModel  # noqa: E402


# dedicated test db configs
TEST_DB_NAME = os.environ.get("TEST_DB_NAME", "journal_db_test")
# use different port for test API to avoid conflicts with dev server
TEST_API_PORT = int(os.environ.get("TEST_API_PORT", "8001"))
TEST_API_BASE_URL = f"http://localhost:{TEST_API_PORT}"
# Keep API_BASE_URL for backward compatibility, but default to test server
API_BASE_URL = os.environ.get("API_BASE_URL", TEST_API_BASE_URL)

# Global variable to track test API server process
_test_api_process: subprocess.Popen | None = None


def check_pg_connection(max_retries: int = 5, retry_delay: float = 1.0) -> bool:
    log.info(f"Checking PostgreSQL connection at {DB_HOST}:{DB_PORT}...")

    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASSWORD,
                # db irrel -- just want to check server is reachable
                database="postgres",
                connect_timeout=2,
            )
            conn.close()
            log.info(f"PostgreSQL is available (attempt {attempt + 1}/{max_retries})")
            return True
        except Exception as e:
            if attempt == 0 or (attempt + 1) % 2 == 0:
                log.info(
                    f"Waiting for PostgreSQL... (attempt {attempt + 1}/{max_retries}): {type(e).__name__}"
                )

        if attempt < max_retries - 1:
            time.sleep(retry_delay)

    log.error(f"PostgreSQL failed to become available after {max_retries} attempts")
    return False


def wait_for_api_health(
    api_url: str, max_retries: int = 10, retry_delay: float = 1.0
) -> bool:
    """Wait for API server to be ready and healthy."""
    log.info(f"Waiting for API server at {api_url} to be ready...")
    health_url = f"{api_url}/health"

    last_error = None
    for attempt in range(max_retries):
        try:
            response = httpx.get(health_url, timeout=2.0)
            if response.status_code == 200:
                health_data = response.json()
                if health_data.get("database") == "connected":
                    log.info(
                        f"API server is ready (attempt {attempt + 1}/{max_retries})"
                    )
                    return True
                else:
                    # Server is responding but DB not connected
                    last_error = (
                        f"Database status: {health_data.get('database', 'unknown')}"
                    )
                    if "database_error" in health_data:
                        last_error += f" - {health_data['database_error']}"
            else:
                # Server responded but with error status
                try:
                    error_data = response.json()
                    last_error = f"HTTP {response.status_code}: {error_data}"
                except Exception:
                    last_error = f"HTTP {response.status_code}"
        except httpx.ConnectError:
            last_error = "Connection refused - server not started yet"
        except Exception as e:
            last_error = f"{type(e).__name__}: {str(e)}"
            if attempt == 0 or (attempt + 1) % 5 == 0:
                log.info(
                    f"Waiting for API... (attempt {attempt + 1}/{max_retries}): {last_error}"
                )

        if attempt < max_retries - 1:
            time.sleep(retry_delay)

    log.error(f"API server failed to become ready after {max_retries} attempts")
    if last_error:
        log.error(f"Last error: {last_error}")
    return False


def start_test_api_server(db_name: str, port: int = TEST_API_PORT) -> subprocess.Popen:
    """Start a dedicated test API server in a subprocess."""
    log.info(f"Starting test API server on port {port} with database {db_name}...")

    backend_dir = Path(__file__).resolve().parent.parent
    src_dir = backend_dir / "src"
    api_module = "api.routes.main:app"
    env = os.environ.copy()

    # determine Python executable - use sys.executable (should be venv Python)
    python_exe = sys.executable

    # ensure venv properly inherited
    if hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix:
        # --> in a venv
        venv_prefix = Path(sys.prefix)
        venv_bin = venv_prefix / "bin"

        if venv_bin.exists():
            current_path = env.get("PATH", "")
            # prepend venv bin to PATH to ensure venv packages are found
            env["PATH"] = f"{venv_bin}:{current_path}"
            env["VIRTUAL_ENV"] = str(venv_prefix)

            # also add site-packages to PYTHONPATH as a safety measure
            # (helps ensure packages are found even if venv activation isn't perfect)
            site_packages = (
                venv_prefix
                / "lib"
                / f"python{sys.version_info.major}.{sys.version_info.minor}"
                / "site-packages"
            )
            if site_packages.exists():
                pythonpath_parts = [str(site_packages)]
            else:
                pythonpath_parts = []
        else:
            pythonpath_parts = []
    else:
        pythonpath_parts = []

    # ensure PYTHONPATH includes src directory so api module can be found
    pythonpath_parts.insert(0, str(src_dir))

    # set PYTHONPATH
    if pythonpath_parts:
        existing_pythonpath = env.get("PYTHONPATH", "")
        if existing_pythonpath:
            env["PYTHONPATH"] = ":".join(pythonpath_parts + [existing_pythonpath])
        else:
            env["PYTHONPATH"] = ":".join(pythonpath_parts)

    # set db config - these must be set before load_dotenv() runs
    env["DB_NAME"] = db_name
    # pass through other db config if not already set
    for db_config in ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"]:
        if db_config not in env:
            env[db_config] = str(globals()[db_config])

    # ensure we use the test db (not DATABASE_URL from .env)
    env.pop("DATABASE_URL", None)

    # JWT config for test API server matching the config at top of file
    env["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", TEST_JWT_SECRET_KEY)
    env["JWT_ALGORITHM"] = os.environ.get("JWT_ALGORITHM", "HS256")
    env["JWT_ACCESS_TOKEN_EXPIRE_MINUTES"] = os.environ.get(
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30"
    )
    # start uvicorn server
    log.info(f"Using Python: {python_exe}")
    log.info(f"PYTHONPATH: {env.get('PYTHONPATH', 'not set')}")

    process = subprocess.Popen(
        [
            python_exe,
            "-m",
            "uvicorn",
            api_module,
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "warning",  # reduce noise from test server
        ],
        cwd=backend_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,  # combine stderr with stdout for easier debugging
        text=True,
    )

    log.info(f"Test API server process started (PID: {process.pid})")
    return process


def stop_test_api_server(process: subprocess.Popen | None) -> None:
    """Stop the test API server process."""
    if process is None:
        return

    log.info(f"Stopping test API server (PID: {process.pid})...")

    try:
        # graceful shutdown
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            # force kill if can't terminate gracefully
            log.warning("Test API server didn't terminate gracefully, forcing kill...")
            process.kill()
            process.wait()

        # Read any remaining output for debugging
        try:
            stdout, _ = process.communicate(timeout=1)
            if stdout:
                log.debug(f"Test API server final output: {stdout[:500]}")
        except (subprocess.TimeoutExpired, ValueError):
            pass

        log.info("Test API server stopped successfully")
    except Exception as e:
        log.warning(f"Error stopping test API server: {e}")
        try:
            process.kill()
        except Exception:
            pass


def create_test_database(db_name: str) -> None:
    log.info(f"Creating test database: {db_name}")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        # db doesn't matter, we're just using it to connect to the server
        database="postgres",
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

    try:
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        exists = cursor.fetchone()

        if not exists:
            cursor.execute(f'CREATE DATABASE "{db_name}"')
            log.info(f"Test database '{db_name}' created successfully")
        else:
            log.info(f"Test database '{db_name}' already exists")
        cursor.close()
    finally:
        conn.close()


def drop_test_database(db_name: str) -> None:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database="postgres",  # Connect to default postgres database
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)

    try:
        cursor = conn.cursor()
        # terminate any active connections
        cursor.execute(
            """
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = %s
            AND pid <> pg_backend_pid()
            """,
            (db_name,),
        )
        # drop db
        cursor.execute(f'DROP DATABASE IF EXISTS "{db_name}"')
        cursor.close()
    finally:
        conn.close()


def run_migrations(db_name: str) -> None:
    log.info(f"Running migrations on test database: {db_name}")
    alembic_dir = Path(__file__).resolve().parent.parent / "alembic"
    env = os.environ.copy()
    env["DB_NAME"] = db_name

    try:
        log.info(f"Executing: alembic upgrade head (DB_NAME={db_name})")
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=alembic_dir.parent,
            env=env,
            capture_output=True,
            text=True,
            check=True,
        )
        if result.stdout:
            log.debug(f"Alembic output: {result.stdout}")
        log.info(f"Migrations completed successfully for database: {db_name}")
    except subprocess.CalledProcessError as e:
        log.error(f"Alembic migration failed: {e.stderr}")
        if e.stdout:
            log.error(f"Alembic stdout: {e.stdout}")
        raise


@pytest.fixture(scope="session")
def test_database() -> Generator[str, None, None]:
    """session-scoped fixture that creates test db at start and drops it at end."""
    global _test_api_process

    session_start = time.time()
    log.info("=" * 60)
    log.info("Starting test session - Setting up test database and API server")
    log.info("=" * 60)

    # check db availability first
    pg_start = time.time()
    if not check_pg_connection():
        msg = "PostgreSQL connection failed - database may not be ready"
        log.error(msg)
        pytest.fail(msg)
    pg_elapsed = time.time() - pg_start
    log.info(f"PostgreSQL check completed in {pg_elapsed:.2f}s")

    db_create_start = time.time()
    create_test_database(TEST_DB_NAME)
    db_create_elapsed = time.time() - db_create_start
    log.info(f"Database creation completed in {db_create_elapsed:.2f}s")

    try:
        # run migrations
        migration_start = time.time()
        run_migrations(TEST_DB_NAME)
        migration_elapsed = time.time() - migration_start
        log.info(f"Migrations completed in {migration_elapsed:.2f}s")

        # start dedicated test API server
        api_start = time.time()
        _test_api_process = start_test_api_server(TEST_DB_NAME, TEST_API_PORT)

        # wait for API server to be ready
        if not wait_for_api_health(TEST_API_BASE_URL):
            # try to read error output from the subprocess for debugging
            if _test_api_process:
                try:
                    # check if process is still running
                    if _test_api_process.poll() is not None:
                        # process has exited, try to read output
                        try:
                            stdout, _ = _test_api_process.communicate(timeout=1)
                            if stdout:
                                log.error("Test API server output:")
                                for line in stdout.split("\n")[-30:]:  # Last 30 lines
                                    if line.strip():
                                        log.error(f"  {line}")
                        except (subprocess.TimeoutExpired, ValueError):
                            pass
                except Exception:
                    # if we can't read output, wtever. fail silently at this point
                    pass

            stop_test_api_server(_test_api_process)
            _test_api_process = None
            msg = "Test API server failed to start or become healthy"
            log.error(msg)
            pytest.fail(msg)

        api_elapsed = time.time() - api_start
        log.info(f"Test API server started and ready in {api_elapsed:.2f}s")

        setup_elapsed = time.time() - session_start
        log.info(
            f"Test environment ready (database: {TEST_DB_NAME}, API: {TEST_API_BASE_URL}, setup took {setup_elapsed:.2f}s)"
        )
        log.info("-" * 60)
        yield TEST_DB_NAME
    finally:
        # stop test API server
        if _test_api_process is not None:
            stop_test_api_server(_test_api_process)
            _test_api_process = None

        # drop test db
        # NOTE: deliberately not logging during teardown as pytest may have closed logging streams (errors here)
        try:
            drop_test_database(TEST_DB_NAME)
        except Exception:
            pass


# register cleanup function to ensure server is stopped even if pytest is interrupted
def _cleanup_test_api():
    """Cleanup function to ensure test API server is stopped."""
    global _test_api_process
    if _test_api_process is not None:
        stop_test_api_server(_test_api_process)
        _test_api_process = None


atexit.register(_cleanup_test_api)

# --------------------------------------------------------------------------------------------------------------------------------
# auth utils
# --------------------------------------------------------------------------------------------------------------------------------


def _create_test_token(user_id: uuid.UUID) -> str:
    """create JWT access token for a test user"""
    return create_access_token(user_id)


def _create_test_user_in_db(
    db_name: str,
    email: str | None = None,
    external_auth_sub: str | None = None,
    name: str | None = None,
    picture: str | None = None,
) -> dict:
    """create a test user directly in the database (bypassing API).
    - for test setup: need user before making authenticated API calls

    Returns:
        user data dict
    """
    import datetime as dt

    if email is None:
        email = f"test_{int(time.time())}_{uuid.uuid4().hex[:8]}@example.com"
    if external_auth_sub is None:
        external_auth_sub = f"test_sub_{int(time.time())}_{uuid.uuid4().hex[:8]}"

    user_id = uuid.uuid4()
    now = dt.datetime.now(dt.timezone.utc)

    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=db_name,
    )

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO core.users (id, email, external_auth_sub, name, picture, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, email, external_auth_sub, name, picture, created_at, updated_at, last_login_at
            """,
            (str(user_id), email, external_auth_sub, name, picture, now, now),
        )
        row = cursor.fetchone()
        conn.commit()
        if row is None:
            raise ValueError("No user created in database")

        return {
            "id": str(row[0]),
            "email": row[1],
            "external_auth_sub": row[2],
            "name": row[3],
            "picture": row[4],
            "created_at": row[5].isoformat() if row[5] else None,
            "updated_at": row[6].isoformat() if row[6] else None,
            "last_login_at": row[7].isoformat() if row[7] else None,
        }
    finally:
        conn.close()


def _delete_test_user_from_db(db_name: str, user_id: str) -> None:
    """delete a test user directly from the database."""
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=db_name,
    )

    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM core.users WHERE id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()


class AuthenticatedClient:
    """
    wrapper around httpx.Client, automatically adds auth header to all requests
    """

    def __init__(self, base_url: str, token: str, timeout: httpx.Timeout):
        self._token = token
        self._client = httpx.Client(base_url=base_url, timeout=timeout)

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self._client.close()

    def _add_auth_header(self, headers: dict | None) -> dict:
        """add auth header to request headers"""
        if headers is None:
            headers = {}
        headers = dict(headers)  # Make a copy
        headers["Authorization"] = f"Bearer {self._token}"
        return headers

    def get(self, url: str, **kwargs):
        kwargs.setdefault("headers", {})
        kwargs["headers"] = self._add_auth_header(kwargs["headers"])
        return self._client.get(url, **kwargs)

    def post(self, url: str, **kwargs):
        kwargs.setdefault("headers", {})
        kwargs["headers"] = self._add_auth_header(kwargs["headers"])
        return self._client.post(url, **kwargs)

    def patch(self, url: str, **kwargs):
        kwargs.setdefault("headers", {})
        kwargs["headers"] = self._add_auth_header(kwargs["headers"])
        return self._client.patch(url, **kwargs)

    def put(self, url: str, **kwargs):
        kwargs.setdefault("headers", {})
        kwargs["headers"] = self._add_auth_header(kwargs["headers"])
        return self._client.put(url, **kwargs)

    def delete(self, url: str, **kwargs):
        kwargs.setdefault("headers", {})
        kwargs["headers"] = self._add_auth_header(kwargs["headers"])
        return self._client.delete(url, **kwargs)

    def close(self):
        self._client.close()


# --------------------------------------------------------------------------------------------------------------------------------
# Test fixtures
# --------------------------------------------------------------------------------------------------------------------------------


@pytest.fixture
def authenticated_user(test_database: str) -> Generator[dict, None, None]:
    """
    Create an authenticated test user directly in the database.
    Returns user data and access token.

    Yields:
        Dictionary with user data and 'token' key containing JWT token
    """
    user_data = _create_test_user_in_db(test_database)
    user_id = uuid.UUID(user_data["id"])
    token = _create_test_token(user_id)

    user_with_token = {**user_data, "token": token}

    yield user_with_token

    # Cleanup
    try:
        _delete_test_user_from_db(test_database, user_data["id"])
    except Exception:
        pass


@pytest.fixture
def client(
    test_database: str, authenticated_user: dict
) -> Generator[AuthenticatedClient, None, None]:
    """
    function-scoped fixture that provides authenticated http client for testing.
    Uses the dedicated test API server started by the test_database fixture.
    Automatically includes Authorization header with JWT token from authenticated_user fixture.
    """
    timeout = httpx.Timeout(10.0, connect=5.0)
    token = authenticated_user["token"]

    with AuthenticatedClient(TEST_API_BASE_URL, token, timeout) as http_client:
        try:
            response = http_client.get("/health", timeout=5.0)
            if response.status_code != 200:
                pytest.fail(
                    f"Test API server at {TEST_API_BASE_URL} returned status {response.status_code}. "
                    f"This should not happen - the server should be running from the test_database fixture."
                )
        except (httpx.ConnectError, httpx.TimeoutException) as e:
            pytest.fail(
                f"Test API server at {TEST_API_BASE_URL} is not reachable. "
                f"This should not happen - the server should be running from the test_database fixture. "
                f"Error: {type(e).__name__}"
            )
        yield http_client


@pytest.fixture
def load_test_data():
    """helper fixture"""

    def _load_data(file_path: str) -> dict | list:
        test_data_dir = Path(__file__).resolve().parent / "test_data"
        full_path = test_data_dir / file_path

        if not full_path.exists():
            raise FileNotFoundError(f"Test data file not found: {full_path}")

        with open(full_path, "r") as f:
            return json.load(f)

    return _load_data


@pytest.fixture
def test_user(client: AuthenticatedClient) -> Generator[dict, None, None]:
    """
    Create a test user via API (requires authenticated client), yield it, and delete it after the test.

    Yields:
        User data dictionary
    """
    user_data = {
        "email": f"test_{int(time.time())}_{uuid.uuid4().hex[:8]}@example.com",
        "external_auth_sub": f"test_sub_{int(time.time())}_{uuid.uuid4().hex[:8]}",
    }

    response = client.post("/api/latest/users", json=[user_data])
    response.raise_for_status()
    result = response.json()
    created_user = result["data"][0]

    yield created_user

    try:
        client.delete("/api/latest/users", params={"ids": [str(created_user["id"])]})
    except Exception:
        pass


@pytest.fixture
def test_thread(
    client: AuthenticatedClient, authenticated_user: dict
) -> Generator[dict, None, None]:
    """
    Create a test thread, yield it, and delete it after the test.

    Requires:
        authenticated_user: The authenticated user fixture

    Yields:
        Thread data dictionary
    """
    import datetime as dt

    thread_data = {
        "user_id": str(authenticated_user["id"]),
        "date": str(dt.date.today()),
    }

    response = client.post("/api/latest/threads", json=[thread_data])
    response.raise_for_status()
    result = response.json()
    created_thread = result["data"][0]

    yield created_thread

    try:
        client.delete(
            "/api/latest/threads", params={"ids": [str(created_thread["id"])]}
        )
    except Exception:
        pass


@pytest.fixture
def test_entry(
    client: AuthenticatedClient, test_thread: dict
) -> Generator[dict, None, None]:
    """
    Create a test entry, yield it, and delete it after the test.

    Requires:
        test_thread: A thread fixture

    Yields:
        Entry data dictionary
    """
    entry_data = {
        "thread_id": str(test_thread["id"]),
        "raw_markdown": "Test entry content",
    }

    response = client.post("/api/latest/entries", json=[entry_data])
    response.raise_for_status()
    result = response.json()
    created_entry = result["data"][0]

    yield created_entry

    try:
        client.delete(f"/api/latest/entries/{created_entry['id']}")
    except Exception:
        pass


@pytest.fixture
def test_metric(
    client: AuthenticatedClient, test_thread: dict
) -> Generator[dict, None, None]:
    """
    Create a test metric, yield it, and delete it after the test.

    Requires:
        test_thread: A thread fixture

    Yields:
        Metric data dictionary
    """
    metric_data = {
        "thread_id": str(test_thread["id"]),
        "sleep_quality": 7,
        "physical_activity": 3,
        "overall_mood": 6,
    }

    response = client.post("/api/latest/metrics", json=[metric_data])
    response.raise_for_status()
    result = response.json()
    created_metric = result["data"][0]

    yield created_metric

    try:
        client.delete(
            "/api/latest/metrics", params={"ids": [str(created_metric["id"])]}
        )
    except Exception:
        pass
