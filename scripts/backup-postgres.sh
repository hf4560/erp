#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST required}"
: "${PGUSER:?PGUSER required}"
: "${PGDATABASE:?PGDATABASE required}"
: "${PGPASSWORD:?PGPASSWORD required}"

BACKUP_DIR=${BACKUP_DIR:-./backups}
mkdir -p "$BACKUP_DIR"
TS=$(date -u +"%Y%m%dT%H%M%SZ")
FILE="$BACKUP_DIR/${PGDATABASE}_$TS.dump"

pg_dump -Fc -h "$PGHOST" -U "$PGUSER" "$PGDATABASE" > "$FILE"
echo "Backup created: $FILE"
