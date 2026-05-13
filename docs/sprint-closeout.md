# Sprint Closeout: MVP -> Pre-Prod Hardening

## Closed in this sprint
- Backend state moved to Prisma persistence (devices/revisions/bom/tasks/autopilot policy/jobs).
- Basic write protection added via `x-api-key` for mutating endpoints.
- Added health endpoints: `/healthz`, `/readyz`.
- Added audit trail model (`AuditLog`) and write-event audit logging.
- Added role-based access controls:
  - `PATCH /autopilot/search/policy` -> `cost_engineer | manager | admin`
  - `GET /audit-logs` -> `manager | admin`
- Added JWT auth bootstrap:
  - `POST /auth/login` issues bearer token for demo users
  - RBAC can resolve role from JWT claims (fallback to header for compatibility)
- Expanded integration tests to cover auth, RBAC and health/readiness.

## Remaining to hit full production
1. PostgreSQL migration (from SQLite) + managed backups + PITR.
2. OIDC + RBAC backed by identity provider (replace demo login and header fallback).
3. Kafka workers for webhook ingestion, retries, DLQ.
4. Vault integration for dynamic secrets.
5. Helm/k8s manifests + rollout pipeline.
6. SLO dashboards + alert policies + DR drills.

## Sprint exit criteria status
- API persistence: ✅
- API smoke/integration tests: ✅
- Minimal security controls (write auth + RBAC): ✅
- Production infrastructure stack: ⏳
- Full security/compliance controls: ⏳
