#!/usr/bin/env zsh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

verify_and_set_gcp_project() {
    local project_id=$1
    
    if [ -z "$project_id" ]; then
        log_error "GCP project ID is empty or not set"
        exit 1
    fi
    
    log_info "Setting GCP project to: $project_id"
    
    if ! gcloud config set project "$project_id" &>/dev/null; then
        log_error "Failed to set project to '$project_id'. Project may not exist. Please create the project or check the PROJECT_ID."
        exit 1
    fi
}

