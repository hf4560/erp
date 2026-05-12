# Production Plan: Git-native ERP/PLM (Self-Hosted GitLab + K8s)

## 1) Целевая архитектура (production)

### 1.1 Принципы
- Система хранит в Git не только код, но и инженерные артефакты: BOM, спецификации, CAD-метаданные, release notes, test reports.
- GitLab self-hosted является центральным source-of-truth и разворачивается в этом же Kubernetes-кластере.
- Внешняя публикация сервисов через Traefik Ingress Controller.
- Event-driven интеграция через Kafka.
- Secrets и dynamic credentials через HashiCorp Vault.

### 1.2 Логические сервисы
1. `gitlab` (self-hosted)
2. `traefik` (ingress + tls termination)
3. `erp-api` (core domain + auth + policy engine)
4. `git-integration-worker` (webhook ingest + polling + sync)
5. `bom-processing-worker` (парсинг/нормализация BOM)
6. `cost-engine-worker` (оценка, округление, snapshots)
7. `pricing-adapter` (источники цен + FX rates)
8. `frontend` (Next.js)
9. `postgresql` (primary DB)
10. `redis` (cache + job state)
11. `kafka` (+ schema-registry optional)
12. `vault` (secrets)
13. `prometheus`, `grafana`, `alertmanager`, `cadvisor` (monitoring)
14. `backup-controller` (DB + GitLab backup orchestration)

### 1.3 Сетевой контур и маршрутизация
- `gitlab.example.com` -> Traefik -> GitLab webservice.
- `erp.example.com` -> Traefik -> frontend.
- `api.erp.example.com` -> Traefik -> erp-api.
- `webhooks.erp.example.com` -> Traefik -> git-integration-worker.
- mTLS внутри service mesh (опционально, этап 2).

## 2) Стандарты хранения данных в Git (не только код)

### 2.1 Рекомендуемая структура репозитория устройства
```
/device-{name}
  /electronics
    /bom
      bom.csv
      bom.json
    /schematics
      *.kicad_sch
  /mechanical
    /bom
      bom.csv
    /cad
      metadata.json
      exports/
  /firmware
    /src
  /docs
    requirements.md
    change-log.md
  /release
    revision.yaml
```

### 2.2 Поддерживаемые BOM форматы (MVP + prod)
- **CSV (основной MVP)**
  - encoding UTF-8
  - delimiter `,`
  - обязательные поля: `part_name, mpn, manufacturer, quantity, unit_cost, currency, category`
  - опциональные: `supplier, lead_time_days, lifecycle, min_order_qty, notes`
- **JSON (расширенный формат)**
  - schema versioned (`bom_schema_version`)
  - список items + metadata блока (source repo, commit sha, timestamp)

### 2.3 Размещение BOM
- Эталон: `/<subsystem>/bom/bom.csv`.
- Альтернатива: `/<subsystem>/bom/bom.json`.
- Приоритет парсинга: `json > csv` при наличии обоих.

## 3) Cost/FX/policy конфигурация с редактированием на фронте

### 3.1 Что редактируется в UI
- Базовая валюта системы (`BASE_CURRENCY`) — хранится в env/DB policy config.
- Правила округления:
  - precision (2/3/4)
  - mode (`HALF_UP`, `HALF_EVEN`, `DOWN`, `UP`)
- Multipliers по категориям и/или по устройству.
- Приоритеты источников цен.
- FX provider strategy и fallback.

### 3.2 Где хранить
- Runtime policy: PostgreSQL таблицы `cost_policy`, `rounding_policy`, `pricing_source_policy`, `fx_policy`.
- Кеш/быстрый доступ: Redis.
- Секреты API ключей поставщиков: Vault.

### 3.3 Источники цен
- Primary: supplier APIs (Octopart/part distributor APIs where available).
- Secondary: internal price lists (manual upload CSV).
- Tertiary fallback: last-known-good snapshot.

### 3.4 FX курсы
- Авто-парсинг по расписанию (`*/30 * * * *`) из 2 независимых провайдеров.
- Валидация расхождения между провайдерами (threshold alert).
- fallback на предыдущий валидный курс.

## 4) Орг-процесс (предложение)

### 4.1 Роли
- `Hardware Engineer`
- `Firmware Engineer`
- `Cost Engineer`
- `Project Manager`
- `Release Manager`
- `Admin`

### 4.2 Workflow Revision
1. `draft` -> auto after tag/merge
2. `review` -> инженерная/стоимостная проверка
3. `approved` -> release manager approval
4. `released` -> immutable snapshot

### 4.3 Workflow задач
- Статусы: `todo`, `in_progress`, `blocked`, `review`, `done`.
- SLA:
  - cost_reduction: 10 business days
  - bug: 3 business days
  - design: 15 business days
  - optimization: 20 business days

## 5) Kubernetes deployment blueprint

### 5.1 Namespaces
- `edge` (traefik)
- `platform` (vault, kafka, monitoring)
- `gitlab`
- `erp`
- `data`

### 5.2 State management
- PostgreSQL: operator-managed + PITR backups.
- Kafka: 3 brokers min for prod.
- Vault: HA mode (raft).
- GitLab: official Helm chart with external object storage.

### 5.3 Ingress + TLS
- Traefik with cert-manager (Let's Encrypt / internal CA).
- Separate entrypoints for public API and webhooks.
- Rate limiting + WAF rules (phase 2).

## 6) Security baseline

### 6.1 Controls
- SSO/OIDC for users.
- Service-to-service auth via JWT/mTLS.
- Secret rotation via Vault dynamic secrets.
- At-rest encryption for DB volumes.
- Audit logs immutable storage.

### 6.2 Supply-chain security
- Image signing (cosign).
- SBOM generation (syft) + vulnerability scan (grype/trivy).
- Admission policy (kyverno or opa-gatekeeper).

## 7) Monitoring & alerting (classic stack)

### 7.1 Metrics
- API latency p95/p99
- Queue lag (Kafka consumer lag)
- BOM parse success ratio
- Cost recompute duration
- FX refresh freshness
- GitLab webhook success rate

### 7.2 Dashboards
- Exec: cost trends/revision velocity
- Engineering: ingestion/parsing health
- Platform: infra resources + pod health

### 7.3 Alerts
- High webhook failure rate > 5% / 5m
- FX stale > 2h
- Kafka lag > threshold
- DB replication/backup failures

## 8) Backup & DR strategy
- PostgreSQL: nightly full + WAL archiving, RPO <= 15 min.
- GitLab: daily backup artifacts/repos/config.
- Vault: raft snapshots + unseal key procedure.
- Quarterly DR drills with documented RTO/RPO validation.

## 9) AI/LLM слой (Ollama на RTX 4050 Laptop 16GB VRAM)

### 9.1 Цель AI слоя
- Ускорить работу с инженерными артефактами (BOM, revision notes, task triage), а не только с кодом.
- Добавить explainability для cost-решений (почему изменилась себестоимость между ревизиями).
- Поддержать безопасный режим локального инференса в контуре компании.

### 9.2 Рекомендуемые модели (production/dev)
- **Primary**: `qwen2.5-coder:7b-instruct-q4_K_M` (баланс качества/скорости/VRAM для 16GB).
- **Fallback-general**: `llama3.1:8b-instruct-q4_K_M` (универсальные задачи и документация).
- **Fast-lite**: `qwen2.5:3b-instruct-q4_K_M` (быстрые UI-подсказки и классификация задач).

### 9.3 Размещение и эксплуатация Ollama
- Отдельный сервис `ollama-gateway` в namespace `erp`.
- Доступ только из внутренних сервисов (`erp-api`, `bom-processing-worker`, `task-assistant-worker`).
- Модельный роутинг по типу задачи:
  - BOM normalization/extraction -> primary.
  - Task summarization/classification -> fast-lite.
  - Policy/cost explanation -> fallback-general.

### 9.4 Набор AI use-cases (после MVP)
- Нормализация BOM полей (manufacturer aliases, units, lifecycle tags).
- Автогенерация task из GitLab MR/commit/webhook контекста.
- Объяснение `cost delta` между revision `N` и `N+1` в human-readable виде.
- Поиск дубликатов деталей (MPN/производитель/аналог).

### 9.5 Guardrails и безопасность
- PII/secret redaction перед отправкой в модель.
- Prompt/version registry в БД для аудита.
- Ограничение контекста: в prompt передаются только релевантные BOM/task/revision данные.
- Feature-flag rollout: AI фичи включаются поэтапно по командам/проектам.

## 10) Web search autopilot (инженерные данные и цены)

### 10.1 Зачем нужен autopilot
- Автопоиск цен, availability и lifecycle для BOM-позиций.
- Автопоиск datasheet/PCN/EOL уведомлений по MPN.
- Автопоиск альтернативных компонентов при риске поставок.

### 10.2 Архитектура web-search слоя
- Новый сервис `web-search-worker` (job-driven через Kafka).
- Очереди:
  - `price.lookup.requested`
  - `datasheet.lookup.requested`
  - `substitution.lookup.requested`
- Результаты пишутся в `external_intel_snapshot` с указанием источника, времени и confidence score.

### 10.3 Режимы работы
- `manual`: запуск только из UI кнопкой (первая фаза).
- `assisted-autopilot`: запуск по событиям (новый BOM import, release candidate).
- `full-autopilot`: периодический refresh + policy-driven trigger rules.

### 10.4 Policy и UX
- На фронте редактируются:
  - whitelist/blacklist доменов источников,
  - приоритеты источников,
  - TTL кэша результатов,
  - порог confidence для автообновления цены.
- Все auto-updates проходят через review queue при high-impact изменениях (например >7% cost delta).

### 10.5 Надежность и контроль качества
- Rate limiting и backoff для внешних источников.
- Дедупликация запросов по `(mpn, manufacturer, currency, region)`.
- История изменений с reason-codes (какой источник и почему выбран).
- Alerting: резкий рост `price volatility`, stale search data, высокий fail-rate внешних запросов.

## 11) Этапный план внедрения

### Phase 0 (1 неделя) — Foundation
- Утверждение схем BOM и policy model.
- GitLab project template + repo layout docs.

### Phase 1 (2 недели) — Platform bootstrap
- K8s namespaces, Traefik, Vault, Kafka, monitoring stack.
- GitLab self-hosted deployment behind Traefik.

### Phase 2 (2 недели) — ERP Core hardening
- Перевод in-memory в PostgreSQL/Prisma runtime.
- RBAC, audit, policy editing APIs.

### Phase 3 (2 недели) — Integration & processing
- Webhook ingest worker + Kafka pipeline.
- BOM parser service + validation/error catalog.
- Cost engine snapshots + FX refresh pipeline.

### Phase 4 (2 недели) — Frontend + Ops
- UI для policy/config редактирования (валюта, rounding, multipliers, price source priority).
- SLO dashboards + alert tuning.

### Phase 5 (1 неделя) — Production readiness
- Load tests, security checks, backup/restore drills.
- Runbooks + on-call handoff.

## 12) Что нужно от команды (input checklist)
1. Домены и DNS для Traefik ingress.
2. Требования по compliance (GDPR/ISO/internal).
3. Предпочтительные price providers (контракты/API keys).
4. Бизнес-правила утверждения ревизий (кто аппрувит).
5. SLA по доступности (99.5/99.9) и целевые RPO/RTO.
