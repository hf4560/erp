# Git-native ERP/PLM

Production-oriented ERP/PLM для hardware-разработки, где GitLab выступает источником инженерных данных, а ERP-слой управляет ревизиями, BOM, себестоимостью и задачами.

## Микросервисная архитектура

```text
[GitLab]
   | REST API + Webhooks
   v
[gitlab-integration-service] ---> [Redis queue]
                                  |
                                  v
                            [data-processing-service]
                                  |
                                  v
                              [core-backend-api] <----> [PostgreSQL]
                                  |
                                  v
                              [frontend (Next.js)]
```

### Сервисы
- **gitlab-integration-service**
  - Подключение GitLab project.
  - Получение commits/branches/tags/MR через GitLab REST API.
  - Обработка webhook событий: `push`, `merge request`, `tag push`.
  - Публикация событий в очередь.

- **data-processing-service**
  - Парсинг BOM (CSV/JSON).
  - Нормализация BOM item'ов.
  - Извлечение метаданных инженерных файлов.
  - Обработка CAD как metadata extractor (без preview в текущей версии).

- **core-backend-api (ERP service)**
  - Бизнес-логика Device/Revision/Subsystem/Task.
  - Cost Engine и cost breakdown.
  - API для фронтенда.

- **frontend (Next.js)**
  - Dashboard устройств.
  - Device page (ревизии + подсистемы + cost).
  - Revision page (BOM + задачи + git activity).
  - Task board (kanban).

## Текущее состояние репозитория
- `apps/backend` — backend API (TypeScript + Express, подготовка под NestJS split).
- `apps/backend/prisma/schema.prisma` — модель данных PostgreSQL.
- `docs/mvp-spec.md` — подробное ТЗ и критерии успеха.
- `apps/frontend` — рабочий Next.js frontend (dashboard/device/revision pages + backend API integration).

## Основные endpoints
- `GET /devices`
- `POST /devices`
- `GET /devices/:id`
- `GET /devices/:id/revisions`
- `POST /revisions` (manual override)
- `GET /revisions/:id/bom`
- `POST /revisions/:id/bom/import`
- `GET /revisions/:id/tasks`
- `POST /tasks`
- `PATCH /tasks/:id`
- `GET /revisions/:id/cost`
- `POST /integrations/gitlab/connect`
- `POST /webhooks/gitlab`
- `POST /auth/dev-token` (dev/test only)

## Быстрый старт backend
```bash
cd apps/backend
npm install
npm run build
npm run start:dev
```


## Production planning
- Подробный production-план: `docs/production-plan.md`.

## Windows 10 autodeploy (autopilot + Ollama)
- Инструкция: `docs/windows-autodeploy.md`.
- Скрипт автодеплоя: `deploy/windows/autodeploy.ps1`.
- Compose-профиль: `deploy/docker-compose.autopilot.yml`.

- Sprint closeout status: `docs/sprint-closeout.md`.

## Vault runtime bootstrap
- Start backend with dynamic DB credentials from Vault: `scripts/run-backend-with-vault.sh`.

- Rotate Vault DB credentials to env file: `scripts/vault-rotate-db-creds.sh`.
- CI/CD workflow scaffold: `.github/workflows/ci-cd.yml`.

## Ops readiness artifacts
- Prometheus alerts: `ops/observability/prometheus-alerts.yml`.
- Grafana dashboard: `ops/observability/grafana-dashboard-erp.json`.
- k6 load test: `ops/loadtest/k6-revisions.js`.
- DR drill docs: `ops/dr/drill-checklist.md`, `ops/dr/drill-report-template.md`.
