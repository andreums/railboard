#!/bin/sh
# RailBoard SQLite Database Backup Script
# Usage: ./scripts/backup.sh [backup-dir]
# Default backup directory: ../backups/ relative to script
# Intended to be run from host via: docker exec railboard-backend /app/scripts/backup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="${1:-$SCRIPT_DIR/../backups}"
DB_PATH="${DB_PATH:-/app/data/data.db}"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/railboard-backup-${TIMESTAMP}.db"

# Use WAL checkpoint to ensure data is flushed
sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true

cp "$DB_PATH" "$BACKUP_FILE"
echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Clean old backups
find "$BACKUP_DIR" -name 'railboard-backup-*.db' -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
echo "Retention: keeping last ${RETENTION_DAYS} days"
