#!/usr/bin/env zsh
# creates storage bucket, builds backup job image, creates and schedules cr job

# configs
set -e
source "$(dirname $0)/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
GCP_REGION=${GCP_REGION:-"europe-west2"}
ARTIFACT_REGISTRY_REPO=${ARTIFACT_REGISTRY_REPO:-"daily-journal"}
SERVICE_ACCOUNT_NAME=${SERVICE_ACCOUNT_NAME:-"daily-journal-sa"}
BACKUP_BUCKET_PREFIX=${BACKUP_BUCKET_PREFIX:-"daily-journal-backups"}
JOB_NAME=${JOB_NAME:-"daily-journal-backup"}
SCHEDULER_JOB_NAME=${SCHEDULER_JOB_NAME:-"daily-journal-backup-schedule"}
IMAGE_NAME="backup-job"

BACKUP_BUCKET="${BACKUP_BUCKET_PREFIX}-${GCP_PROJECT_ID}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
FULL_IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}/${IMAGE_NAME}:latest"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/../backup"

log_info "Starting backup pipeline setup..."
log_info "Project: $GCP_PROJECT_ID"
log_info "Region: $GCP_REGION"
log_info "Backup Bucket: $BACKUP_BUCKET"
log_info "Job Name: $JOB_NAME"
log_info ""

log_info "Verifying database secrets exist in Secret Manager..."
REQUIRED_SECRETS=("db-host" "db-port" "db-user" "db-password" "db-name")
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gcloud secrets describe "$secret" --project="$GCP_PROJECT_ID" &>/dev/null; then
        log_error "Required secret '$secret' not found in Secret Manager"
        log_error "Please run setup-secrets.sh first to create the secrets"
        exit 1
    fi
done
log_info "  > All required secrets verified"
log_info ""

log_info "Enabling required GCP APIs..."
APIS=(
    "cloudscheduler.googleapis.com"
    "run.googleapis.com"
    "appengine.googleapis.com"
)
for api in "${APIS[@]}"; do
    if gcloud services list --enabled --filter="config.name=$api" --format="value(config.name)" --limit=1 | grep -q "^${api}$"; then
        log_info "  > API $api is already enabled"
    else
        log_info "  > Enabling $api..."
        gcloud services enable "$api" --project="$GCP_PROJECT_ID"
    fi
done
log_info ""

log_info "Ensuring App Engine is initialized (creates default service account)..."
if gcloud app describe --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_info "  > App Engine is already initialized"
else
    log_info "  > Initializing App Engine (this creates the default service account)..."
    gcloud app create --region=europe-west2 --project="$GCP_PROJECT_ID" 2>&1 | grep -v "already exists" || true
    log_info "  > App Engine initialized"
fi
log_info ""

log_info "Creating Cloud Storage bucket for backups..."
if gsutil ls -b "gs://$BACKUP_BUCKET" &>/dev/null; then
    log_info "  > Backup bucket '$BACKUP_BUCKET' already exists"
else
    gsutil mb -p "$GCP_PROJECT_ID" -l "$GCP_REGION" "gs://$BACKUP_BUCKET"
    log_info "  > Created backup bucket: $BACKUP_BUCKET"
    
    LIFECYCLE_CONFIG_FILE="${SCRIPT_DIR}/backup-lifecycle-config.json"
    gsutil lifecycle set "$LIFECYCLE_CONFIG_FILE" "gs://$BACKUP_BUCKET"
    log_info "  > Applied lifecycle policy: delete timestamped backups older than 30 days"
fi
log_info ""

log_info "Granting storage permissions to service account..."
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.objectAdmin" \
    --condition=None \
    &>/dev/null || true
log_info "  > Granted storage.objectAdmin role to service account"
log_info ""

log_info "Building backup job Docker image..."
cd "${SCRIPT_DIR}/.."
log_info "  > Building image: $FULL_IMAGE_NAME"
docker build --platform linux/amd64 -f backup/Dockerfile -t "$FULL_IMAGE_NAME" .
if [ $? -ne 0 ]; then
    log_error "Docker build failed"
    exit 1
fi
log_info "  > Image built successfully"

log_info "Pushing image to Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet
docker push "$FULL_IMAGE_NAME"
if [ $? -ne 0 ]; then
    log_error "Failed to push image to Artifact Registry"
    exit 1
fi
log_info "  > Image pushed successfully"
log_info ""

log_info "Creating Cloud Run Job..."
SECRETS_ARGS="DB_HOST=db-host:latest,DB_PORT=db-port:latest,DB_USER=db-user:latest,DB_PASSWORD=db-password:latest,DB_NAME=db-name:latest"

if gcloud run jobs describe "$JOB_NAME" --region="$GCP_REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_info "  > Updating existing Cloud Run Job..."
    if ! gcloud run jobs update "$JOB_NAME" \
        --image="$FULL_IMAGE_NAME" \
        --region="$GCP_REGION" \
        --service-account="$SERVICE_ACCOUNT_EMAIL" \
        --set-secrets="$SECRETS_ARGS" \
        --set-env-vars="GCS_BUCKET=$BACKUP_BUCKET" \
        --memory="512Mi" \
        --cpu="1" \
        --max-retries="1" \
        --task-timeout="30m" \
        --project="$GCP_PROJECT_ID"; then
        log_error "Failed to update Cloud Run Job"
        exit 1
    fi
    log_info "  > Job updated successfully"
else
    log_info "  > Creating new Cloud Run Job..."
    if ! gcloud run jobs create "$JOB_NAME" \
        --image="$FULL_IMAGE_NAME" \
        --region="$GCP_REGION" \
        --service-account="$SERVICE_ACCOUNT_EMAIL" \
        --set-secrets="$SECRETS_ARGS" \
        --set-env-vars="GCS_BUCKET=$BACKUP_BUCKET" \
        --memory="512Mi" \
        --cpu="1" \
        --max-retries="1" \
        --task-timeout="30m" \
        --project="$GCP_PROJECT_ID"; then
        log_error "Failed to create Cloud Run Job"
        exit 1
    fi
    log_info "  > Job created successfully"
fi
log_info ""

log_info "Setting up Cloud Scheduler job..."
SCHEDULE=${BACKUP_SCHEDULE:-"0 2 * * *"}  # daily at 2am UTC
JOB_URI="https://$GCP_REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$GCP_PROJECT_ID/jobs/$JOB_NAME:run"

SCHEDULER_SERVICE_ACCOUNT="${GCP_PROJECT_ID}@appspot.gserviceaccount.com"

log_info "  > Granting Cloud Scheduler permission to invoke backup job..."
gcloud run jobs add-iam-policy-binding "$JOB_NAME" \
    --region="$GCP_REGION" \
    --member="serviceAccount:$SCHEDULER_SERVICE_ACCOUNT" \
    --role="roles/run.invoker" \
    --project="$GCP_PROJECT_ID" \
    &>/dev/null || true

if gcloud scheduler jobs describe "$SCHEDULER_JOB_NAME" --location="$GCP_REGION" --project="$GCP_PROJECT_ID" &>/dev/null; then
    log_info "  > Updating existing Cloud Scheduler job..."
    if ! gcloud scheduler jobs update http "$SCHEDULER_JOB_NAME" \
        --location="$GCP_REGION" \
        --schedule="$SCHEDULE" \
        --uri="$JOB_URI" \
        --http-method="POST" \
        --oidc-service-account-email="$SCHEDULER_SERVICE_ACCOUNT" \
        --project="$GCP_PROJECT_ID"; then
        log_error "Failed to update Cloud Scheduler job"
        exit 1
    fi
    log_info "  > Scheduler job updated successfully"
else
    log_info "  > Creating new Cloud Scheduler job..."
    if ! gcloud scheduler jobs create http "$SCHEDULER_JOB_NAME" \
        --location="$GCP_REGION" \
        --schedule="$SCHEDULE" \
        --uri="$JOB_URI" \
        --http-method="POST" \
        --oidc-service-account-email="$SCHEDULER_SERVICE_ACCOUNT" \
        --time-zone="UTC" \
        --project="$GCP_PROJECT_ID"; then
        log_error "Failed to create Cloud Scheduler job"
        exit 1
    fi
    log_info "  > Scheduler job created successfully"
fi
log_info ""

log_info ""
log_info "============================================"
log_info "Backup pipeline setup complete!"
log_info "============================================"
log_info ""
log_info "Resources created:"
log_info "  ✓ Cloud Storage Bucket: gs://$BACKUP_BUCKET"
log_info "  ✓ Cloud Run Job: $JOB_NAME"
log_info "  ✓ Cloud Scheduler Job: $SCHEDULER_JOB_NAME"
log_info "  ✓ Schedule: $SCHEDULE (Daily at 2 AM UTC)"
log_info ""
log_info "Trigger manually: gcloud run jobs execute $JOB_NAME --region $GCP_REGION"
log_info ""
log_info "============================================"
log_info ""
