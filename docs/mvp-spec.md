# MVP Spec: Git-native ERP/PLM

## 1. Цель
Доказать, что Git-based hardware development можно превратить в управляемый ERP-процесс с полной трассировкой ревизий и себестоимости.

## 2. Архитектура и микросервисы

### 2.1 Сервисы
1. **core-backend-api**
   - API слой
   - бизнес-логика ревизий
   - расчет себестоимости
   - управление задачами
2. **gitlab-integration-service**
   - GitLab REST API клиент
   - webhook ingest
   - синхронизация commits/branches/tags/MR
3. **data-processing-service**
   - BOM parser (CSV/JSON)
   - metadata extraction
   - CAD metadata-only parsing
4. **frontend**
   - Dashboard / Device / Revision / Task board

### 2.2 Поток данных
- `repo -> subsystem -> revision`
- Webhook (`push`, `tag push`, `merge request`) -> gitlab-integration-service -> queue -> backend/data-processing.
- BOM агрегируется по подсистемам для выбранной revision.

## 3. Сущности
- Device
- Revision
- Subsystem
- BOM Item
- Task
- Cost Snapshot

## 4. Бизнес-логика MVP
- На `tag push` и `merge to main` создается revision.
- BOM собирается из файлов подсистем.
- Cost engine считает `total_cost = Σ(unitCost × quantity)`.
- Для `mechanical` применяется manufacturing complexity multiplier.
- Для `firmware` стоимость = 0 в MVP.

## 5. API (MVP)
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

## 6. Ограничения MVP
- Без CAD preview.
- Без AI-аналитики.
- Без supply chain prediction.
- Без real-time collaboration.
- Без сложных PLM workflow.

## 7. Критерии успеха
1. Создается device.
2. Подключается GitLab repo.
3. Revision создается автоматически.
4. BOM собирается.
5. Стоимость считается.
6. Показывается breakdown.
7. Задачи привязаны к revision.

## 8. Будущие расширения (не в MVP)
- AI cost optimizer.
- Automatic BOM substitution.
- CAD parsing (STEP/EDA, включая preview/semantic extraction).
- Manufacturing pipeline integration.
- Supply chain AI.
- Real-time co-design.
