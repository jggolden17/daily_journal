#!/bin/bash
# db backup script for cr job

set -e
source "$(dirname $0)/scripts-utils.sh"

DB_HOST=${DB_HOST:-""}
DB_PORT=${DB_PORT:-"5432"}
DB_USER=${DB_USER:-""}
DB_PASSWORD=${DB_PASSWORD:-""}
DB_NAME=${DB_NAME:-""}

GCS_BUCKET=${GCS_BUCKET:-""}
BACKUP_FILE_NAME="latest-backup.sql.gz"
TIMESTAMPED_BACKUP_NAME="backup-$(date +%Y-%m-%d-%H%M%S).sql.gz"

if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ] || [ -z "$GCS_BUCKET" ]; then
    log_error "Missing required environment variables"
    log_error "Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, GCS_BUCKET"
    exit 1
fi

log_info "Starting database backup..."
log_info "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
log_info "User: $DB_USER"
log_info "Destination: gs://$GCS_BUCKET/$BACKUP_FILE_NAME"
log_info ""

# temp dir for backup files
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

DUMP_FILE="$TEMP_DIR/dump.sql"
GZIP_FILE="$TEMP_DIR/dump.sql.gz"

log_info "Creating database dump..."
export PGPASSWORD="$DB_PASSWORD"
export PGSSLMODE="${PGSSLMODE:-require}"
ERROR_OUTPUT="$TEMP_DIR/pg_dump_errors.txt"
if ! pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-acl --clean --if-exists \
    --verbose 2>"$ERROR_OUTPUT" > "$DUMP_FILE"; then
    log_error "pg_dump failed"
    log_error "Error output:"
    cat "$ERROR_OUTPUT" | while IFS= read -r line; do
        log_error "  $line"
    done
    rm -f "$ERROR_OUTPUT"
    exit 1
fi
rm -f "$ERROR_OUTPUT"
unset PGPASSWORD

if [ ! -s "$DUMP_FILE" ]; then
    log_error "Dump file is empty or does not exist"
    exit 1
fi

DUMP_SIZE=$(stat -f%z "$DUMP_FILE" 2>/dev/null || stat -c%s "$DUMP_FILE" 2>/dev/null)
log_info "Dump created successfully (${DUMP_SIZE} bytes)"
log_info ""

log_info "Compressing dump file..."
if ! gzip -c "$DUMP_FILE" > "$GZIP_FILE"; then
    log_error "gzip failed"
    exit 1
fi

GZIP_SIZE=$(stat -f%z "$GZIP_FILE" 2>/dev/null || stat -c%s "$GZIP_FILE" 2>/dev/null)
log_info "Compression complete (${GZIP_SIZE} bytes, $(echo "scale=1; (1 - $GZIP_SIZE / $DUMP_SIZE) * 100" | bc)% reduction)"
log_info ""

log_info "Checking for existing backup in Cloud Storage..."
EXISTING_BACKUP_SIZE=0
if gsutil stat "gs://$GCS_BUCKET/$BACKUP_FILE_NAME" &>/dev/null; then
    EXISTING_BACKUP_SIZE=$(gsutil du -s "gs://$GCS_BUCKET/$BACKUP_FILE_NAME" 2>/dev/null | awk '{print $1}' || echo "0")
    log_info "Existing backup found (${EXISTING_BACKUP_SIZE} bytes)"
    
    if [ "$GZIP_SIZE" -lt "$EXISTING_BACKUP_SIZE" ]; then
        log_warn "New backup is smaller than existing backup!"
        log_warn "New: ${GZIP_SIZE} bytes, Existing: ${EXISTING_BACKUP_SIZE} bytes"
        log_warn "This might indicate data loss. Keeping existing backup."
        log_warn "Skipping upload."
        exit 0
    else
        log_info "New backup is larger than existing, as expected (${GZIP_SIZE} bytes >= ${EXISTING_BACKUP_SIZE} bytes)"
    fi
else
    log_info "No existing backup found. This is the first backup."
fi

log_info ""
log_info "Uploading backup to Cloud Storage..."
if ! gsutil cp "$GZIP_FILE" "gs://$GCS_BUCKET/$BACKUP_FILE_NAME"; then
    log_error "Failed to upload backup to Cloud Storage"
    exit 1
fi
log_info "Also uploading timestamped backup copy..."
if ! gsutil cp "$GZIP_FILE" "gs://$GCS_BUCKET/$TIMESTAMPED_BACKUP_NAME"; then
    log_warn "Failed to upload timestamped backup copy (non-critical, continuing anyway)"
else
    log_info "Timestamped backup saved: $TIMESTAMPED_BACKUP_NAME"
fi

log_info ""
log_info "============================================"
log_info "Backup completed successfully!"
log_info "============================================"
log_info ""
log_info "Backup file: gs://$GCS_BUCKET/$BACKUP_FILE_NAME"
log_info "Size: ${GZIP_SIZE} bytes"
log_info ""
