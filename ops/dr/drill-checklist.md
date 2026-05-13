# DR Drill Checklist (Quarterly)

## Scope
- PostgreSQL restore from latest nightly backup
- Vault unseal + secret re-issuance validation
- ERP API functional smoke checks after restore

## Steps
1. Pick latest backup artifact and record checksum.
2. Restore DB into isolated recovery environment.
3. Run migration/version check (`prisma migrate status`).
4. Point ERP API to restored DB and run smoke tests.
5. Validate sample business flows:
   - create device
   - create revision
   - import BOM
   - get cost snapshot
6. Validate webhook dedup state for replay safety.
7. Record RTO/RPO and compare against targets.
8. Publish drill report + incident actions.
