# Sprint Closeout: Production Sprint (Platform + Security + Runtime)

## Closed in this sprint
- Prisma datasource switched to PostgreSQL provider.
- Removed demo-login endpoint from main runtime path; auth now expects bearer identity context (dev token endpoint is test-only mode).
- Removed role fallback dependency for privileged flows by requiring claim-based role in RBAC checks.
- Added Kafka worker runtime skeletons:
  - `apps/workers/src/webhook-worker.ts` with processed/DLQ routing.
  - `apps/workers/src/web-search-worker.ts` with completed/DLQ routing.
- Added PostgreSQL backup/restore operational scripts:
  - `scripts/backup-postgres.sh`
  - `scripts/restore-postgres.sh`
- Added production compose baseline with PostgreSQL + Kafka:
  - `deploy/docker-compose.prod.yml`
- Added Helm deployment baseline for `erp-api` with readiness/liveness probes and secret wiring:
  - `infra/helm/erp/templates/deployment.yaml`

## Remaining to full production gate
- None for current sprint scope. Operational artifacts for observability, load-test and DR drill are added under `ops/`.
