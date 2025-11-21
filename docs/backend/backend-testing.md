# Backend Testing Guide

This guide covers how to run and write tests for the Daily Journal backend.

## Test Structure

Tests are located in the `backend/tests/` directory:

```
.
├── test_data
│   ├── core
│   │   └── users
│   └── journal
│       ├── entries
│       ├── metrics
│       └── threads
└── test_routes
    ├── test_core
    └── test_journal

```

## Running Tests

Note: see [pytest.ini](../../backend/pytest.ini) for the default settings when calling pytest. In particular, `maxfail=1` --> the test summary saying 1 test failed does *not* mean there is only 1 broken test.

To run all:

```bash
cd backend
poetry run pytest
```

To run a specific file:

```bash
poetry run pytest tests/test_routes/test_core/test_users.py
```

Run a Single Test

```bash
poetry run pytest tests/test_routes/test_core/test_users.py::test_specific_function -v
```

## Test Configuration

The test configuration is `tests/conftest.py`:

- **Database and API**: Tests use a dedicated test database & API which is created/destroyed before/after each test session
- **Fixtures**: Common test fixtures are defined in `conftest.py` to create/delete key test data before/after each specific test
- **Test Data**: JSON files in `test_data/` provide reusable test payloads
