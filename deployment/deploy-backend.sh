#!/usr/bin/env zsh
# deploy backend from artifact reg to cr
# TODO: allow for specification of version, then deploy that version after verifying. For rollbacks
# configs & setup
set -e
source "$(dirname $0)/setup-scripts/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
GCP_REGION=${GCP_REGION:-"europe-west2"}
ARTIFACT_REGISTRY_REPO=${ARTIFACT_REGISTRY_REPO:-"daily-journal"}
SERVICE_NAME=${SERVICE_NAME:-"daily-journal-backend"}
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"daily-journal-sa"}
IMAGE_NAME="backend"
FULL_IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}/${IMAGE_NAME}:latest"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

log_info "Starting backend deployment..."
log_info "Project: $GCP_PROJECT_ID"
log_info "Region: $GCP_REGION"
log_info "Service: $SERVICE_NAME"
log_info "Image: $FULL_IMAGE_NAME"
log_info ""

log_info "Verifying secrets exist in Secret Manager..."
REQUIRED_SECRETS=("db-host" "db-port" "db-user" "db-password" "db-name" "jwt-secret-key" "google-client-id" "encryption-key")
PIDS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    log_info "  > Checking secret exists: $secret"
    (gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" &>/dev/null) &
    PIDS+=($!)
done
FAILED=0
for ((i = 0; i < ${#REQUIRED_SECRETS[@]}; i++)); do
    if ! wait "${PIDS[$i]}"; then
        log_error "Required secret '${REQUIRED_SECRETS[$i]}' not found in Secret Manager"
        FAILED=1
    fi
done
if [ $FAILED -eq 1 ]; then
    exit 1
fi
log_info "All required secrets verified"
log_info ""

log_info "Getting frontend URL for CORS configuration..."
STORAGE_BUCKET_PREFIX=${STORAGE_BUCKET_PREFIX:-"daily-journal-frontend"}
STORAGE_BUCKET="${STORAGE_BUCKET_PREFIX}-${GCP_PROJECT_ID}"
FRONTEND_URL="https://storage.googleapis.com"
FRONTEND_URL_ALT="https://${STORAGE_BUCKET}.web.app"
CORS_ORIGINS="${FRONTEND_URL},${FRONTEND_URL_ALT}"

log_info "Deploying to Cloud Run..."
SECRETS_ARGS="DB_PASSWORD=db-password:latest,DB_HOST=db-host:latest,DB_PORT=db-port:latest,DB_USER=db-user:latest,DB_NAME=db-name:latest,JWT_SECRET_KEY=jwt-secret-key:latest,GOOGLE_CLIENT_ID=google-client-id:latest,ENCRYPTION_KEY=encryption-key:latest"
if gcloud secrets describe "allowed-ips" --project="$GCP_PROJECT_ID" &>/dev/null; then
    SECRETS_ARGS="${SECRETS_ARGS},ALLOWED_IPS=allowed-ips:latest"
fi
# Create a temporary env vars file in YAML format to handle CORS_ORIGINS with commas properly
TEMP_ENV_FILE=$(mktemp)
cat > "$TEMP_ENV_FILE" <<EOF
JWT_ALGORITHM: HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES: "30"
CORS_ORIGINS: "${CORS_ORIGINS}"
USE_SSL: "true"
EOF

if gcloud run services describe "$SERVICE_NAME" --region="$GCP_REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_info "Updating existing Cloud Run service..."
    gcloud run services update "$SERVICE_NAME" \
        --image="$FULL_IMAGE_NAME" \
        --region="$GCP_REGION" \
        --service-account="$SERVICE_ACCOUNT_EMAIL" \
        --set-secrets="$SECRETS_ARGS" \
        --env-vars-file="$TEMP_ENV_FILE" \
        --memory="512Mi" \
        --cpu="1" \
        --min-instances="0" \
        --max-instances="10" \
        --project="$GCP_PROJECT_ID"
    
    if [ $? -ne 0 ]; then
        rm -f "$TEMP_ENV_FILE"
        log_error "Cloud Run service update failed"
        exit 1
    fi
    
    log_info "Ensuring unauthenticated access allowed (so browser can connect)..."
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
        --env-vars-file="$TEMP_ENV_FILE" \
        --memory="512Mi" \
        --cpu="1" \
        --min-instances="0" \
        --max-instances="10" \
        --allow-unauthenticated \
        --port="8000" \
        --project="$GCP_PROJECT_ID"
    
    if [ $? -ne 0 ]; then
        rm -f "$TEMP_ENV_FILE"
        log_error "Cloud Run deployment failed"
        exit 1
    fi
fi

# Clean up temp file
rm -f "$TEMP_ENV_FILE"

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
