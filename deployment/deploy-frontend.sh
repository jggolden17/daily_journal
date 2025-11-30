#!/usr/bin/env zsh

set -e
source "$(dirname $0)/setup-scripts/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
GCP_REGION=${GCP_REGION:-"europe-west2"}
STORAGE_BUCKET_PREFIX=${STORAGE_BUCKET_PREFIX:-"daily-journal-frontend"}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR=${FRONTEND_DIR:-"$SCRIPT_DIR/../frontend"}
STORAGE_BUCKET="${STORAGE_BUCKET_PREFIX}-${GCP_PROJECT_ID}"
BACKEND_URL=${BACKEND_URL:-""}

# make it easy to get the backend URL
if [ -z "$BACKEND_URL" ]; then
    SERVICE_NAME=${SERVICE_NAME:-"daily-journal-backend"}
    BACKEND_URL=$(gcloud run services describe "$SERVICE_NAME" \
        --region="$GCP_REGION" \
        --format='value(status.url)' \
        --project="$GCP_PROJECT_ID" 2>/dev/null || echo "")
    
    if [ -z "$BACKEND_URL" ]; then
        log_warn "Backend URL not set and couldn't retrieve from Cloud Run"
        read "BACKEND_URL?Enter your backend URL (e.g., https://xxx.run.app): "
    else
        log_info "Retrieved backend URL from Cloud Run: $BACKEND_URL"
    fi
fi
if ! gsutil ls -b "gs://$STORAGE_BUCKET" &>/dev/null; then
    log_error "Storage bucket does not exist: $STORAGE_BUCKET"
    exit 1
fi
if [ ! -d "$FRONTEND_DIR" ]; then
    log_error "Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

log_info "Starting frontend deployment..."
log_info "Project: $GCP_PROJECT_ID"
log_info "Bucket: $STORAGE_BUCKET"
log_info "Backend URL: $BACKEND_URL"
log_info ""

cd "$FRONTEND_DIR"
log_info "Installing npm dependencies..."
npm install
log_info ""

log_info "Building frontend app with backend: $BACKEND_URL..."

# Get Google Client ID from Secret Manager if it exists
GOOGLE_CLIENT_ID=""
if gcloud secrets describe google-client-id --project="$GCP_PROJECT_ID" &>/dev/null; then
    GOOGLE_CLIENT_ID=$(gcloud secrets versions access latest --secret="google-client-id" --project="$GCP_PROJECT_ID")
    log_info "Retrieved Google Client ID from Secret Manager"
else
    log_warn "Google Client ID secret not found. OAuth will not work until it's configured."
fi

# Set environment variables for build
# Add /api suffix to match backend route structure (all routes are under /api)
export VITE_API_BACKEND_URL="$BACKEND_URL/api"
export VITE_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
npm run build
if [ $? -ne 0 ]; then
    log_error "Build failed"
    exit 1
fi
log_info "Build completed successfully"
log_info ""

log_info "Uploading to Cloud Storage bucket: $STORAGE_BUCKET"
log_info "Clearing existing files in bucket..."
gsutil -m rm -r "gs://$STORAGE_BUCKET/*" 2>/dev/null || log_info "No existing files to remove"
log_info ""

log_info "Uploading build files..."
gsutil -m cp -r dist/* "gs://$STORAGE_BUCKET/"
if [ $? -ne 0 ]; then
    log_error "Upload failed"
    exit 1
fi

log_info "Setting content types..."
gsutil -m setmeta -h "Content-Type:text/html" "gs://$STORAGE_BUCKET/*.html" 2>/dev/null || true
gsutil -m setmeta -h "Content-Type:application/javascript" "gs://$STORAGE_BUCKET/*.js" 2>/dev/null || true
gsutil -m setmeta -h "Content-Type:text/css" "gs://$STORAGE_BUCKET/*.css" 2>/dev/null || true

# Set cache control for static assets (1 year for assets, no cache for HTML)
log_info "Setting cache headers..."
gsutil -m setmeta -h "Cache-Control:public, max-age=31536000" "gs://$STORAGE_BUCKET/assets/*" 2>/dev/null || true
gsutil -m setmeta -h "Cache-Control:no-cache, no-store, must-revalidate" "gs://$STORAGE_BUCKET/*.html" 2>/dev/null || true

FRONTEND_URL="https://storage.googleapis.com/$STORAGE_BUCKET/index.html"

log_info ""
log_info "============================================"
log_info "Frontend deployment complete!"
log_info "============================================"
log_info ""
log_info "Frontend URL: $FRONTEND_URL"
log_info ""
log_info "============================================"