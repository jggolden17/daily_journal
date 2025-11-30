#!/usr/bin/env zsh
# create secrets in GCP

# configs
set -e
source "$(dirname $0)/scripts-utils.sh"
GCP_PROJECT_ID=${GCP_PROJECT_ID:-""}
verify_and_set_gcp_project "$GCP_PROJECT_ID"
log_info "Setting up secrets for project: $GCP_PROJECT_ID"
log_info ""

create_or_update_secret() {
    local secret_name=$1
    local secret_description=$2
    local current_value=""
    
    # check if secret exists already, and ask to update if so
    if gcloud secrets describe "$secret_name" --project="$GCP_PROJECT_ID" &>/dev/null; then
        log_warn "Secret '$secret_name' already exists"
        read "?Do you want to update it? (y/n): " update
        if [[ ! "$update" =~ ^[Yy]$ ]]; then
            log_info "Skipping $secret_name"
            return
        fi
        current_value=$(gcloud secrets versions access latest --secret="$secret_name" --project="$GCP_PROJECT_ID" 2>/dev/null || echo "")
        if [ -n "$current_value" ]; then
            echo "Current value: ${current_value:0:20}..."
        fi
    fi
    
    echo ""
    read -s "SECRET_VALUE?Enter value for $secret_name: "
    if [ -z "$SECRET_VALUE" ]; then
        log_warn "Empty value provided, skipping $secret_name"
        return
    fi
    echo ""   
    
    # upsert
    if gcloud secrets describe "$secret_name" --project="$GCP_PROJECT_ID" &>/dev/null; then
        echo -n "$SECRET_VALUE" | gcloud secrets versions add "$secret_name" --data-file=- --project="$GCP_PROJECT_ID"
        log_info "Updated secret: $secret_name"
    else
        echo -n "$SECRET_VALUE" | gcloud secrets create "$secret_name" \
            --data-file=- \
            --replication-policy="automatic" \
            --project="$GCP_PROJECT_ID"
        log_info "Created secret: $secret_name"
    fi
    
    unset SECRET_VALUE
}

log_info "========================================="
log_info "db configs.."
log_info "========================================="
log_info ""

create_or_update_secret "db-host" "db hostname (e.g., ep-*************.eu-west-2.aws.neon.tech)"
create_or_update_secret "db-port" "db port"
create_or_update_secret "db-user" "db username"
create_or_update_secret "db-password" "db password"
create_or_update_secret "db-name" "db name"

echo ""
echo "========================================="
echo "API configs.."
echo "========================================="
echo ""

# JWT Secret
echo "JWT Secret Key:"
echo "  > This should be a secure random string (at least 32 characters)."
read "?  > Generate a random JWT secret automatically? (y/n): " generate_jwt
if [[ "$generate_jwt" =~ ^[Yy]$ ]]; then
    JWT_SECRET=$(openssl rand -hex 32 | tr -d '\n')
    echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret-key \
        --data-file=- \
        --replication-policy="automatic" \
        --project="$GCP_PROJECT_ID" 2>/dev/null || \
    echo -n "$JWT_SECRET" | gcloud secrets versions add jwt-secret-key \
        --data-file=- \
        --project="$GCP_PROJECT_ID"
    log_info "Created/updated jwt-secret-key (randomly generated)"
    echo "Secret value: $JWT_SECRET (saved in Secret Manager)"
else
    create_or_update_secret "jwt-secret-key" "JWT secret key for token signing (min 32 chars)"
fi
# google oauth configs
create_or_update_secret "google-client-id" "Google OAuth Client ID"
create_or_update_secret "google-client-secret" "Google OAuth Client Secret"

log_info ""
log_info "============================================"
log_info "Secret setup complete"
log_info "============================================"
log_info ""

