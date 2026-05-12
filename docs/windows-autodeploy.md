# Windows 10 Autodeploy (ERP + Autopilot + Ollama)

## Что реализовано
- `deploy/docker-compose.autopilot.yml` поднимает `backend`, `redis`, `ollama`.
- `deploy/windows/autodeploy.ps1` запускает стек и автоматически подтягивает модель.

## Запуск
```powershell
Set-ExecutionPolicy -Scope Process Bypass
./deploy/windows/autodeploy.ps1
```

## Целевая машина
- Windows 10
- Ryzen 5 7535HS
- RTX 4060 Laptop 8GB VRAM
- RAM 16GB + pagefile 10GB NVMe

## Модель и режим инференса
- Основная: `qwen2.5-coder:7b-instruct-q4_K_M`.
- Для 8GB VRAM рекомендован mixed режим: частичный GPU + CPU offload.
- Если упирается в память: fallback на `qwen2.5:3b-instruct-q4_K_M`.

## Оценка ресурсов
- Минимум для dev-автопилота: **16GB RAM + 10GB pagefile**.
- Рекомендовано для стабильной параллельной работы (Docker + IDE + браузер + Ollama): **24GB RAM**.
- Комфортный уровень для локального «почти-прод» профиля: **32GB RAM**.

## Что еще нужно для полноценного прода
- Вынести GitLab/Kafka/Vault/Monitoring в отдельный сервер/кластер.
- На ноутбуке оставить dev/test-контур и smoke-проверки.
