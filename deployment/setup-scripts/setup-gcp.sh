#!/usr/bin/env zsh
# script to setup GCP infra to be run once (per project)

# configs
set -e
source "$(dirname $0)/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
GCP_REGION=${GCP_REGION:-"europe-west2"}
ARTIFACT_REGISTRY_REPO=${ARTIFACT_REGISTRY_REPO:-"daily-journal"}
STORAGE_BUCKET_PREFIX=${STORAGE_BUCKET_PREFIX:-"daily-journal-frontend"}
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"daily-journal-sa"}

# bucket name (must be globally unique)
STORAGE_BUCKET="${STORAGE_BUCKET_PREFIX}-${GCP_PROJECT_ID}"
log_info "Starting GCP infrastructure setup..."
log_info "Project: $GCP_PROJECT_ID"
log_info "Region: $GCP_REGION"
log_info "Artifact Registry Repo: $ARTIFACT_REGISTRY_REPO"
log_info "Storage Bucket: $STORAGE_BUCKET"

log_info "Enabling required GCP APIs..."
APIS=(
    "run.googleapis.com"
    "storage.googleapis.com"
    "artifactregistry.googleapis.com"
    "secretmanager.googleapis.com"
    "cloudbuild.googleapis.com"
    "iam.googleapis.com"
)
for api in "${APIS[@]}"; do
    if gcloud services list --enabled --filter="config.name=$api" --format="value(config.name)" --limit=1 | grep -q "^${api}$"; then
        log_info "  > API $api is already enabled"
    else
        log_info "  > Enabling $api..."
        gcloud services enable "$api" --project="$GCP_PROJECT_ID"
    fi
done


log_info "Creating Artifact Registry repository..."
if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPO" \
    --location="$GCP_REGION" \
    --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_info "  > Artifact Registry repository '$ARTIFACT_REGISTRY_REPO' already exists"
else
    gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPO" \
        --repository-format=docker \
        --location="$GCP_REGION" \
        --description="Docker images for Daily Journal app" \
        --project="$GCP_PROJECT_ID"
    log_info "  > Created Artifact Registry repository: $ARTIFACT_REGISTRY_REPO"
fi

log_info "Creating Cloud Storage bucket..."
if gsutil ls -b "gs://$STORAGE_BUCKET" &>/dev/null; then
    log_warn "  > Storage bucket '$STORAGE_BUCKET' already exists (unexpected)"
else
    gsutil mb -p "$GCP_PROJECT_ID" -l "$GCP_REGION" "gs://$STORAGE_BUCKET"
    log_info "  > Created storage bucket: $STORAGE_BUCKET"
fi

log_info "Configuring bucket for static website hosting..."
gsutil web set -m index.html -e index.html "gs://$STORAGE_BUCKET"

log_info "Setting bucket to be publicly readable..."
gsutil iam ch allUsers:objectViewer "gs://$STORAGE_BUCKET"

log_info "Creating service account..."
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_warn "  > Service account '$SERVICE_ACCOUNT_NAME' already exists"
else
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="Daily Journal Service Account" \
        --description="Service account for Daily Journal Cloud Run service" \
        --project="$GCP_PROJECT_ID"
    log_info "  > Created service account: $SERVICE_ACCOUNT_EMAIL"
    
    log_info "  > Waiting for service account to propagate (GCP can take a few secs)..."
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$GCP_PROJECT_ID" &>/dev/null; then
            log_info "  > Service account is ready"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "  > Service account did not become available after $max_attempts seconds"
        exit 1
    fi
fi

log_info "Granting permissions to service account..."
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/secretmanager.secretAccessor"
log_info "  > Granted Secret Manager access to service account"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/run.invoker"
log_info "Service account permissions configured"

log_info "Configuring Docker authentication for Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

log_info ""
log_info "============================================"
log_info "Setup Complete!"
log_info "============================================"
log_info ""
log_info "Project: $GCP_PROJECT_ID"
log_info "Region: $GCP_REGION"
log_info ""
log_info "Created Resources:"
log_info "  ✓ Artifact Registry: $ARTIFACT_REGISTRY_REPO"
log_info "  ✓ Storage Bucket: $STORAGE_BUCKET"
log_info "  ✓ Service Account: $SERVICE_ACCOUNT_EMAIL"
log_info ""
log_info "============================================"
log_info ""
