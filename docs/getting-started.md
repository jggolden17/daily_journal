# Getting Started Guide

Guide to setting up for local dev.

## Prerequisites

- Docker
- Python 3.11+
- [poetry](https://python-poetry.org/) for package mgmt
- Node.js 18+

## Docker Compose

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/jggolden17/daily_journal
   cd dailyJournal
   ```

2. **Set up environment variables** (optional):
   Assuming you don't have other services running that will clash, you can skip this.
   Create a `.env` file in the `containerisation` directory if you want to customize database credentials:
   ```env
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=journal_db
   CORS_ORIGINS=http://localhost:3000
   ```

3. **Start the services**:
   (from within `./continerisation`)
   ```bash
   docker-compose up -d --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
        - API docs: http://localhost:8000/docs

5. **Run database migrations** (first time only):
   ```bash
   docker exec -it daily-journal-backend poetry run alembic upgrade head
   ```

## Local Development

The below steps are only necessary if you're trying to run the backend separately from the front-end.

### Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies** (using poetry):
   ```bash
   poetry install
   ```

3. **Set up backend env variables**:


   Create a `.env` file in the `backend` directory:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=journal_db
   CORS_ORIGINS=http://localhost:3000
   ```

4. **Start PostgreSQL**:

   ```bash
   docker run -d \
     --name daily-journal-db \
     -e POSTGRES_USER=your_db_user \
     -e POSTGRES_PASSWORD=your_db_password \
     -e POSTGRES_DB=journal_db \
     -p 5432:5432 \
     postgres:16-alpine
   ```

5. **Run db migrations**:
   ```bash
   poetry run alembic upgrade head
   ```

6. **Start the backend server**:
   ```bash
   poetry run uvicorn api.routes.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000 (or the port shown in the terminal)

## Verifying the Setup

1. **Check backend health**:
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"status": "healthy"}`

2. **Check API documentation**:
   Open http://localhost:8000/docs in your browser to see the interactive API documentation.

3. **Access the frontend**:
   Open http://localhost:3000 in your browser.

## Troubleshooting

### Database Connection Issues

- Verify the db exists & host/user/pw are as per your env files: `psql -h localhost -p 5432 -U localDbUser -d journal_db -c "SELECT 1;"` (you'll be prompted for the password, or set `PGPASSWORD=your_password` before the command)

### Port Conflicts

- If port 8000 is in use, change the backend port in `docker-compose.yml` (or the uvicorn command when working locally)
- If port 3000 is in use, Vite will automatically use the next available port

## Next Steps

- Read the [Backend Overview](./backend/backend-overview.md) to understand the backend architecture
- Read the [Frontend Overview](./frontend/frontend-overview.md) to understand the frontend structure

