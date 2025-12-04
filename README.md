# Daily Journal

This is largely a practice project. It's a simple web-app where I can write daily notes in markdown & track things like my sleep, physical activity, hours worked, etc. The focus of the project is the backend (the frontend was built with assistance from ai coding tools).

Currently, it's only designed to be used by me. At a later stage I'll adapt it slightly so it can be locally ran by anyone, with the deployed app still restricted to me but set up such that anyone could replicate the implementation.

## Overview

I used to use a simple google-sheet for tracking various metrics & capturing short daily relfections. This project is intended to replace this, with the ability to:
- **Write daily notes** formatted in markdown
- **Track daily metrics** such as mood, sleep, etc.
- **Navigate past entries** to review / edit
- **View summaries of metrics** in some date-range, with avgs., projections, etc.

### Planned next steps
- [ ] "dev-mode" in which (for local/offline dev) gcloud auth is bypassed
- basic deployment in GCP:
    - [x] dev deployment
    - [ ] produciton deployment
- improved security & devops:
    - [x] threat modelling & network security review of GCP infra
    - [x] encrypt all markdown stored in DB
    - [ ] move from simple deployment scripts --> terraform
    - [ ] pre-commit hooks for basic checks, linting, etc.
    - [ ] build python from requirements.txt not poetry when deploying
    - [ ] Quality gate for PR that runs tests (at least of backend)
    - [ ] CI (deploy on PR to main) 
    - [ ] structured logs in GCP with alerting for failures / warnings. Also, currently think backend logs with traceback are shared with client, which is fine for me but bad practice in prod
    - [ ] simple rate-limiting on backend
- improve data-ops:
    - [ ] automatic backups of data (probs into cheap cloudstorage buckets)
- simple feature improvement:
    - [x] markdown editor / preview merged into one
    - [ ] more deliberate front-end design
    - [ ] autosave
    - [ ] metrics page more extensive than simple charts
    - [ ] generate pdf of entries over some date range
    - [ ] search functionality (poss in conflict with desire to encrypt data in db, tradeoff. Probably I'll do something like have encryption on DB but ability to search a secure backup stored elsewhere if I ever need this)
- gen-ai features:
    - [ ] summarising / auto-generating tags for an entry / block of entries
    - [ ] auto-generating follow-up prompts for N-days in future
    - [ ] (more expensive) talking to a LLM with context of previous n-days' entries plus some summary of earlier entries


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

## Tech Stack
While the backend was written ~entirely by me, I made heavy use of ai assistance with the frontend, as this is not my focus.

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL, Alembic
- **Frontend**: TypeScript, React, Vite, Tailwind CSS
- **Cloud deployment:**: GCP, Neon/Aiven
- **Auth**: [Google OAuth](https://developers.google.com/identity/protocols/oauth2)