#!/usr/bin/env zsh
# create secrets in GCP

# configs
set -e
source "$(dirname $0)/scripts-utils.sh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR=${BACKEND_DIR:-"$SCRIPT_DIR/../../backend"}
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

log_info ""
log_info "========================================="
log_info "API configs.."
log_info "========================================="
log_info ""

log_info "JWT Secret Key:"
log_info "  > This should be a secure random string (at least 32 characters)."
log_info "?  > Generate a random JWT secret automatically? (y/n): " generate_jwt
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
log_info "========================================="
log_info "Security configs.."
log_info "========================================="
log_info ""

log_info "Encryption Key:"
log_info "  > This is used to encrypt journal entry content at rest (in db)."
log_info "  > Must be a valid Fernet key (32 bytes, base64-encoded)."
read "?  > Generate a random encryption key automatically? (y/n): " generate_encryption
if [[ "$generate_encryption" =~ ^[Yy]$ ]]; then
    # Generate Fernet key using Poetry (Fernet.generate_key() produces base64-encoded key)
    ENCRYPTION_KEY=$(cd "$BACKEND_DIR" && poetry run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null || echo "")
    if [ -z "$ENCRYPTION_KEY" ]; then
        log_warn "Sorry, failed to generate encryption key with Poetry. Falling back to manual entry."
        create_or_update_secret "encryption-key" "Encryption key for journal entries (Fernet key, base64-encoded)"
    else
        echo -n "$ENCRYPTION_KEY" | gcloud secrets create encryption-key \
            --data-file=- \
            --replication-policy="automatic" \
            --project="$GCP_PROJECT_ID" 2>/dev/null || \
        echo -n "$ENCRYPTION_KEY" | gcloud secrets versions add encryption-key \
            --data-file=- \
            --project="$GCP_PROJECT_ID"
        log_info "Created/updated encryption-key (randomly generated)"
        echo "Secret value: $ENCRYPTION_KEY (saved in Secret Manager)"
    fi
else
    create_or_update_secret "encryption-key" "Encryption key for journal entries (Fernet key, base64-encoded)"
fi

log_info "Enter allowed IP addresses (comma-separated, e.g., 1.2.3.4,5.6.7.8)"
log_info "Leave empty to skip IP filtering - recommended, as IP filtering is something intended for future use when I have OpenVPN setup..."
read "ALLOWED_IPS?Allowed IPs: "
if [ -n "$ALLOWED_IPS" ]; then
    if gcloud secrets describe "allowed-ips" --project="$GCP_PROJECT_ID" &>/dev/null; then
        echo -n "$ALLOWED_IPS" | gcloud secrets versions add allowed-ips --data-file=- --project="$GCP_PROJECT_ID"
        log_info "Updated allowed-ips secret"
    else
        echo -n "$ALLOWED_IPS" | gcloud secrets create allowed-ips \
            --data-file=- \
            --replication-policy="automatic" \
            --project="$GCP_PROJECT_ID"
        log_info "Created allowed-ips secret"
    fi
else
    log_info "Skipping IP filtering (no IPs provided)"
fi

log_info ""
log_info "============================================"
log_info "Secret setup complete"
log_info "============================================"
log_info ""

