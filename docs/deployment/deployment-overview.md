# Deployment overview

TODO: 
- script for making new DB user
- terraform

## Architecture

Everything other than the DB is in Google Cloud Platform (see [ADR](../ADRs/adr-001-db-choice.md) for explanation of why DB is separate — basically cost).

- **Auth**: Google OAuth
- **Database**: Neon (serverless PostgreSQL), but could easily use any other managed pg service
- **Backend**: Cloud Run (FastAPI service)
- **Frontend**: Cloud Storage + Cloud CDN (static React app)
- **Secrets**: Secret Manager (credentials and configs)

## Prerecs

- GCP account w billing enabled, and a project to contain the cloud infra. 
- gcloud cli
- Server with DB set up with external provider (e.g. in Neon)

## Initial setup

1. Set project & region:
```zsh
export GCP_PROJECT_ID="your-project-id"
export GCP_REGION="west-europe2"
```
2. Google OAuth:
    - create credentials (OAuth client ID, internal only, with yourself as a test user) in GCP APIs & Services. Scope required includes `email`, `profile`, `openid`
    - Add local frontend url to authorised origins & URIs (if you want to use google oauth locally)
3. Create DB user & grant appropriate perms
3. Set up core infra
```zsh
chmod +x deployment/setup-scripts/setup-gcp.sh
./deployment/setup-scripts/setup-gcp.sh
```
4. Upload secrets:
```zsh
chmod +x deployment/setup-scripts/setup-secrets.sh
./deployment/setup-scripts/setup-secrets.sh
```
5. Run migrations
```zsh
chmod +x deployment/setup-scripts/run-migrations.sh
./deployment/setup-scripts/run-migrations.sh
```

## Deploying changes

1. Build & deploy backend (will split this into two steps later)
```zsh
chmod +x deployment/build-backend.sh
./deployment/build-backend.sh
chmod +x deployment/deploy-backend.sh
./deployment/deploy-backend.sh
```
2. Build & deploy frontend
```zsh
chmod +x deployment/deploy-frontend.sh
./deployment/deploy-frontend.sh
```
3. Ensure the Google OAuth authorised origins/redirect URIs are updated with front end

## Useful tests

I frequently forget specific `gcloud`/`gsutil` commands, so dumping some common commands here for ref.

Check logs on a service, e.g.:
```zsh
gcloud run services logs read daily-journal-backend --region $GCP_REGION --limit 50
```

Healthcheck backend:
```zsh
curl $SERVICE_URL/health
```
