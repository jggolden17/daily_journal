#!/usr/bin/env zsh
# build and push backend docker img to artifact reg

# configs & setup
set -e
source "$(dirname $0)/setup-scripts/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
GCP_REGION=${GCP_REGION:-"europe-west2"}
ARTIFACT_REGISTRY_REPO=${ARTIFACT_REGISTRY_REPO:-"daily-journal"}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR=${BACKEND_DIR:-"$SCRIPT_DIR/../backend"}
IMAGE_NAME="backend"
FULL_IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPO}/${IMAGE_NAME}:latest"

# check docker running & other pre-reqs
if ! docker info &>/dev/null; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
if [ ! -d "$BACKEND_DIR" ]; then
    log_error "Backend directory not found: $BACKEND_DIR"
    exit 1
fi

log_info "Starting backend build..."
log_info "Project: $GCP_PROJECT_ID"
log_info "Region: $GCP_REGION"
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

log_info "============================================"
log_info "Backend build complete!"
log_info "============================================"
log_info ""
log_info "Image: $FULL_IMAGE_NAME"
log_info ""
log_info "To deploy: ./deployment/deploy-backend.sh "
log_info ""

