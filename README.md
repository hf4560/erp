# Git-native ERP/PLM MVP

MVP прототип ERP/PLM для hardware-разработки с GitLab как источником данных.

## Что реализовано
- Backend API (NestJS-style TypeScript) с доменными модулями: devices, revisions, bom, tasks, cost, gitlab webhook.
- Prisma schema для PostgreSQL.
- MVP Cost Engine (механика/электроника/firmware).
- Документированная архитектура и roadmap для интеграции GitLab webhooks.

## Структура
- `apps/backend` — API и бизнес-логика.
- `apps/backend/prisma/schema.prisma` — схема данных.
- `docs/mvp-spec.md` — формализованное ТЗ и acceptance criteria.

## Быстрый старт (backend)
```bash
cd apps/backend
npm install
npm run start:dev
```

## Основные endpoints (MVP)
- `GET /devices`
- `POST /devices`
- `GET /devices/:id`
- `GET /devices/:id/revisions`
- `POST /revisions`
- `GET /revisions/:id/bom`
- `POST /revisions/:id/bom/import`
- `GET /revisions/:id/tasks`
- `POST /tasks`
- `PATCH /tasks/:id`
- `GET /revisions/:id/cost`
- `POST /integrations/gitlab/connect`
- `POST /webhooks/gitlab`
