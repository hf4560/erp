#!/usr/bin/env bash
set -euo pipefail

: "${VAULT_ADDR:?VAULT_ADDR required}"
: "${VAULT_TOKEN:?VAULT_TOKEN required}"
: "${VAULT_DB_PATH:?VAULT_DB_PATH required (e.g. database/creds/erp-role)}"
: "${DB_HOST:?DB_HOST required}"
: "${DB_PORT:?DB_PORT required}"
: "${DB_NAME:?DB_NAME required}"

CREDS_JSON=$(curl -sS -H "X-Vault-Token: ${VAULT_TOKEN}" "${VAULT_ADDR}/v1/${VAULT_DB_PATH}")
DB_USER=$(echo "$CREDS_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.username))")
DB_PASS=$(echo "$CREDS_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.password))")

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

exec npm run start
