#!/usr/bin/env zsh

# configs
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"

BACKEND_DIR=${BACKEND_DIR:-"$SCRIPT_DIR/../../backend"}
BACKEND_DIR="$(cd "$BACKEND_DIR" && pwd)"
if ! (cd "$BACKEND_DIR" && poetry run alembic --version &> /dev/null); then
    log_error "Something requierd for this script is missing: check $BACKEND_DIR exists, poetry is installed & .venv populated, and Alembic is set up for this project."
    exit 1
fi

log_info "Retrieving db credentials from Secret Manager..."
DB_HOST=$(gcloud secrets versions access latest --secret="db-host" --project="$GCP_PROJECT_ID")
DB_PORT=$(gcloud secrets versions access latest --secret="db-port" --project="$GCP_PROJECT_ID")
DB_USER=$(gcloud secrets versions access latest --secret="db-user" --project="$GCP_PROJECT_ID")
DB_PASSWORD=$(gcloud secrets versions access latest --secret="db-password" --project="$GCP_PROJECT_ID")
DB_NAME=$(gcloud secrets versions access latest --secret="db-name" --project="$GCP_PROJECT_ID")

if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    log_error "Failed to retrieve all required secrets from Secret Manager"
    log_error "Please ensure all secrets are set in Secret Manager for project: $GCP_PROJECT_ID"
    exit 1
fi

# export so alembic can use
export DB_HOST
export DB_PORT
export DB_USER
export DB_PASSWORD
export DB_NAME
log_info "Database credentials retrieved successfully"
log_info "Host: $DB_HOST"
log_info "Port: $DB_PORT"
log_info "Database: $DB_NAME"
log_info "User: $DB_USER"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=require&channel_binding=require"
log_info ""

log_info "Running db migrations..."
cd "$BACKEND_DIR"
log_info "Working directory: $BACKEND_DIR"

log_info "Executing: alembic upgrade head"
poetry run alembic upgrade head

if [ $? -eq 0 ]; then
    log_info "Migrations completed successfully!"
else
    log_error "Migration failed. Please check the error messages above."
    exit 1
fi

log_info ""
log_info "============================================"
log_info "database migrations complete"
log_info "============================================"

