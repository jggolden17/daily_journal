#!/usr/bin/env zsh
# TODO: split this into two scripts: build-backend.sh and deploy-backend.sh

# configs & setup
set -e
source "$(dirname $0)/setup-scripts/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
GCP_REGION=${GCP_REGION:-"europe-west2"}
ARTIFACT_REGISTRY_REPO=${ARTIFACT_REGISTRY_REPO:-"daily-journal"}
SERVICE_NAME=${SERVICE_NAME:-"daily-journal-backend"}
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"daily-journal-sa"}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR=${BACKEND_DIR:-"$SCRIPT_DIR/../backend"}
IMAGE_NAME="backend"
FULL_IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}/${IMAGE_NAME}:latest"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# check docker running & other pre-reqs
if ! docker info &>/dev/null; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

log_info "Starting backend deployment..."
log_info "Project: $GCP_PROJECT_ID"
log_info "Region: $GCP_REGION"
log_info "Service: $SERVICE_NAME"
log_info "Image: $FULL_IMAGE_NAME"
log_info ""

log_info "Building Docker image..."
cd "$BACKEND_DIR"
if [ ! -f "containerisation/Dockerfile" ]; then
    log_error "Dockerfile not found at $BACKEND_DIR/containerisation/Dockerfile"
    exit 1
fi
docker build --platform linux/amd64 -t "$FULL_IMAGE_NAME" -f containerisation/Dockerfile .
if [ $? -ne 0 ]; then
    log_error "Docker build failed"
    exit 1
fi
log_info "Docker image built successfully"
log_info ""

log_info "Pushing image to Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
docker push "$FULL_IMAGE_NAME"
if [ $? -ne 0 ]; then
    log_error "Failed to push image to Artifact Registry"
    exit 1
fi
log_info "Image pushed successfully"
log_info ""

log_info "Verifying secrets exist in Secret Manager..."
REQUIRED_SECRETS=("db-host" "db-port" "db-user" "db-password" "db-name" "jwt-secret-key")
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" &>/dev/null; then
        log_error "Required secret '$secret' not found in Secret Manager"
        exit 1
    fi
done
log_info "All required secrets verified"
log_info ""

log_info "Deploying to Cloud Run..."
SECRETS_ARGS="DB_PASSWORD=db-password:latest,DB_HOST=db-host:latest,DB_PORT=db-port:latest,DB_USER=db-user:latest,DB_NAME=db-name:latest,JWT_SECRET_KEY=jwt-secret-key:latest,GOOGLE_CLIENT_ID=google-client-id:latest"
ENV_VARS_ARGS="JWT_ALGORITHM=HS256,JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30"

if gcloud run services describe "$SERVICE_NAME" --region="$GCP_REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_info "Updating existing Cloud Run service..."
    gcloud run services update "$SERVICE_NAME" \
        --image="$FULL_IMAGE_NAME" \
        --region="$GCP_REGION" \
        --service-account="$SERVICE_ACCOUNT_EMAIL" \
        --set-secrets="$SECRETS_ARGS" \
        --update-env-vars="$ENV_VARS_ARGS" \
        --memory="512Mi" \
        --cpu="1" \
        --min-instances="0" \
        --max-instances="10" \
        --project="$GCP_PROJECT_ID"
    
    if [ $? -ne 0 ]; then
        log_error "Cloud Run service update failed"
        exit 1
    fi
    
    log_info "Allowing unauthenticated access..."
    gcloud run services add-iam-policy-binding "$SERVICE_NAME" \
        --region="$GCP_REGION" \
        --member="allUsers" \
        --role="roles/run.invoker" \
        --project="$GCP_PROJECT_ID"
else
    log_info "Creating new Cloud Run service..."
    gcloud run deploy "$SERVICE_NAME" \
        --image="$FULL_IMAGE_NAME" \
        --region="$GCP_REGION" \
        --platform="managed" \
        --service-account="$SERVICE_ACCOUNT_EMAIL" \
        --set-secrets="$SECRETS_ARGS" \
        --set-env-vars="$ENV_VARS_ARGS" \
        --memory="512Mi" \
        --cpu="1" \
        --min-instances="0" \
        --max-instances="10" \
        --allow-unauthenticated \
        --port="8000" \
        --project="$GCP_PROJECT_ID"
    
    if [ $? -ne 0 ]; then
        log_error "Cloud Run deployment failed"
        exit 1
    fi
fi

# Get service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$GCP_REGION" \
    --format='value(status.url)' \
    --project="$GCP_PROJECT_ID")

log_info ""
log_info "============================================"
log_info "Backend deployment complete!"
log_info "============================================"
log_info ""
log_info "Service URL: $SERVICE_URL"
log_info ""
log_info "Health check:"
log_info "  curl $SERVICE_URL/health"
log_info ""

