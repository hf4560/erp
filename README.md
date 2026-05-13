# Git-native ERP/PLM MVP

MVP прототип ERP/PLM для hardware-разработки, где GitLab выступает источником инженерных данных, а ERP-слой управляет ревизиями, BOM, себестоимостью и задачами.

## Микросервисная архитектура MVP

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
  - Обработка CAD в MVP только как metadata extractor (без preview).

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
- `apps/backend` — MVP backend API (TypeScript + Express, подготовка под NestJS split).
- `apps/backend/prisma/schema.prisma` — модель данных PostgreSQL.
- `docs/mvp-spec.md` — подробное ТЗ и критерии успеха.
- `apps/frontend/README.md` — MVP контур фронтенда.

## Основные endpoints (MVP)
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
