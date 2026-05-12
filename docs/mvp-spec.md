# MVP Spec: Git-native ERP/PLM

## Цель
Доказать, что Git-based hardware development можно превратить в управляемый ERP-процесс с полной трассировкой ревизий и себестоимости.

## Сущности
- Device
- Revision
- Subsystem
- BOM Item
- Task
- Cost Snapshot

## Автоматизация
- На `tag push` и `merge to main` создается revision.
- BOM собирается из файлов подсистем.
- Cost engine считает total_cost = Σ(unitCost × quantity), с мультипликатором для mechanical.

## Критерии успеха
1. Создается device.
2. Подключается GitLab repo.
3. Revision создается автоматически.
4. BOM собирается.
5. Стоимость считается.
6. Показывается breakdown.
7. Задачи привязаны к revision.
