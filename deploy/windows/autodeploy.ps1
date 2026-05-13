$ErrorActionPreference = "Stop"

Write-Host "[1/5] Проверка Docker Desktop..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker не найден. Установите Docker Desktop для Windows 10."
}

Write-Host "[2/5] Запуск инфраструктуры (backend + redis + ollama)..."
docker compose -f deploy/docker-compose.autopilot.yml up -d

Write-Host "[3/5] Ожидание Ollama..."
Start-Sleep -Seconds 5

Write-Host "[4/5] Загрузка рекомендованной модели (qwen2.5-coder 7b q4)..."
docker exec $(docker ps --filter name=ollama --format "{{.ID}}") ollama pull qwen2.5-coder:7b-instruct-q4_K_M

Write-Host "[5/5] Health-check backend..."
try {
  Invoke-RestMethod -Uri "http://localhost:3000/devices" -Method Get | Out-Null
  Write-Host "Готово: автодеплой завершен."
} catch {
  Write-Warning "Backend пока не ответил, проверьте: docker compose logs backend"
}
