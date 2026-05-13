#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:?PGHOST required}"
: "${PGUSER:?PGUSER required}"
: "${PGDATABASE:?PGDATABASE required}"
: "${PGPASSWORD:?PGPASSWORD required}"
: "${BACKUP_FILE:?BACKUP_FILE required}"

pg_restore -c -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" "$BACKUP_FILE"
echo "Restore completed from $BACKUP_FILE"
