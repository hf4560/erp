# Frontend MVP (Next.js)

## Страницы
- Dashboard: список устройств + cost overview.
- Device Page: ревизии, подсистемы, cost breakdown.
- Revision Page: BOM, задачи, git activity, cost graph.
- Task Board: kanban по revision.

## Интеграция с backend API
Frontend работает как отдельный сервис и использует endpoints core-backend-api:
- `/devices`
- `/revisions`
- `/tasks`
- `/integrations/gitlab/connect`

## UI принципы
- Минимализм.
- Инженерная читаемость.
- Табличный фокус + графы.
- Акцент на cost и revision diff.
