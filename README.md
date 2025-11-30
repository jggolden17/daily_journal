# Daily Journal

This is largely a practice project. It's a simple web-app where I can write daily notes in markdown & track things like my sleep, physical activity, hours worked, etc. The focus of the project is the backend; the frontend was built with assistance from ai coding tools. 

## Overview

I used to use a simple google-sheet for tracking various metrics & capturing short daily relfections. This project is intended to replace this, with the ability to:
- **Write daily notes** formatted in markdown
- **Track daily metrics** such as mood, sleep, etc.
- **Navigate past entries** to review / edit
- **View summaries of metrics** in some date-range, with avgs., projections, etc.

### Planned next steps
- basic deployment in GCP: currently only set up for local dev
    - [x] test deployment in sandbox
    - [ ] proper deployment in an enviromnet I will actually use
    - [ ] adapt s.t. in dev mode / something similar, the gcloud oauth isn't required
- set up metrics page to be more extensive than simple charts
- backups (probs cloudstorgage)
- consider encrypting the markdown stored in db for more security
- improve devops (e.g., more secure networking)
- simple gen-ai features:
    - talking to a LLM with context of previous N-days' entries plus some summary of earlier entries
    - generate summaries of all entries in a date range
- better search functionality 

## Docs

See [docs](./docs/) for all documentation, an overview of the key pages is below:
- [Getting started guide](docs/getting-started.md) - Set up and run the project locally
- [Backend overview](docs/backend/backend-overview.md) - Architecture and structure of the backend
- [Frontend overview](docs/frontend/frontend-overview.md) - Architecture and structure of the frontend 
- [Deployment overview](docs/deployment/deployment-overview.md) - Explanation of how the project is deployed to GCP
- [Auth overview](docs/Auth/auth-overview.md) - Explanation of how Google OAuth used, and how to set this up. TODO, write overview of how this works

## Quick Start

Everything is dockerised, so to quickstart:

```bash
cd containerisation && docker-compose up --build -d 
```

This will start:
- pg database on port 5432 (or `DB_PORT` in a `.env`)
- Backend API on port 8000
- Frontend application on port 3000

You will need to run db migrations before the backend will work. For detailed setup instructions, see the [Getting Started Guide](docs/getting-started.md).

TODO: won't work currently without OAuth set-up, need to configure so there's a quick set-up option where the auth is just mocked.

## Tech Stack
While the backend was written ~entirely by me, I made heavy use of ai assistance with the frontend, as this is not my focus.

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- **Frontend**: TypeScript, React, Vite, Tailwind CSS
- **Cloud deployment:**: GCP, Neon/Aiven
- **Auth**: [Google OAuth](https://developers.google.com/identity/protocols/oauth2)