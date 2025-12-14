# Backend Overview

## Architecture

The backend is built with **FastAPI** and follows a layered architecture pattern:

- **Routes** - API endpoints and request/response handling
- **Services** - Business logic layer
- **Data Managers** - Database access layer
- **Models** - SQLAlchemy ORM models
- **Schemas** - Pydantic models for validation and serialization

## Project Structure
(note: might be out of date, regenerate with `tree -L 3 -d -I 'node_modules|__pycache__|.git'`)
```
.
├── alembic
│   └── versions
├── containerisation
├── src
│   └── api
│       ├── api_schemas
│       │   ├── core
│       │   └── journal
│       ├── db
│       │   ├── data_managers
│       │   │   └── journal
│       │   └── models
│       │       ├── core
│       │       └── journal
│       ├── middleware
│       ├── routes
│       │   └── v1
│       │       ├── core
│       │       └── journal
│       ├── services
│       │   ├── core
│       │   └── journal
│       └── utils
└── tests
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

## Key Components

### Routes

Routes handle HTTP requests and responses. They:
- Validate incoming requests using Pydantic schemas
- Call service methods to execute business logic
- Return appropriate HTTP responses

Routes are organized by version (`v1`) and domain (core, journal).

### Services

Services contain the business logic:
- Process data transformations
- Coordinate between multiple data managers
- Handle business rules and validations

### Data Managers

Data managers handle all database operations:
- CRUD operations
- Query building
- Transaction management

They inherit from `BaseDataManager` which provides common database functionality.

### Models

SQLAlchemy ORM models represent database tables:
- `User` - User accounts
- `Thread` - Journal threads (one per day per user)
- `Entry` - Individual journal entries
- `Metrics` - Daily metrics tracking

When these models change, a new migration needs to be generated/applied with alembic.

### Schemas

Pydantic schemas are used for:
- Request validation
- Response serialization
- API docs generation

## Database

- **Database**: PostgreSQL
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic

### Database Schema

The intial ERD for the journal schema is given below (taken from [DBeaver](https://dbeaver.com/docs/dbeaver/)):

<img src="images/initial_joural_schema_ERD.png" alt="Initial Journal Schema ERD" width="50%" />

- **Users**: User accounts with email authentication
- **Threads**: One thread per day per user (contains multiple entries)
- **Entries**: Individual journal entries with markdown content
- **Metrics**: Daily metrics (mood, sleep, etc.) linked to threads

## API Structure

The API is versioned and accessible at:
- `/api/v1/` - Versioned endpoints
- `/api/latest/` - Latest version (currently v1)

### Main Endpoints

- **Users**: `/api/latest/users/`
- **Entries**: `/api/latest/entries/`
- **Metrics**: `/api/latest/metrics/`
- **Threads**: `/api/latest/threads/`

API documentation is available at `/docs` when the server is running.


## Development

### Running the Server

Normally don't bother with this, as given the reload flag int the docker compose it will update on save to relfect changes anyway, when the containers are running.

```bash
poetry run uvicorn api.routes.main:app --host 0.0.0.0 --port 8000 --reload
```

### Database Migrations

Create a new migration (with venv activated):
```bash
alembic revision --autogenerate -m "description"
```

Apply migrations (replace head with +1 to go 1 at a time):
```bash
alembic upgrade head
```

### Testing

See the [Backend Testing Guide](backend-testing.md) for detailed testing information.

