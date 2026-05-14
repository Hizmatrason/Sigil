# Sigil — Licensing & Billing Platform

Self-hosted система лицензирования для on-prem ПО: криптографически защищённые лицензии (Ed25519), оффлайн-работа до 30 дней, иерархия клиентов, биллинг, веб-панель.

## Быстрый старт

### Требования

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) (10.0.202+)
- [Docker](https://www.docker.com/products/docker-desktop/) (для локальных сервисов и интеграционных тестов)
- Git

### Запуск инфраструктуры

```bash
docker compose -f docker-compose.dev.yml up -d
```

Поднимаются:
- **PostgreSQL 16** → `localhost:5432` (user: `sigil`, pass: `sigil_dev`, db: `sigil`)
- **Redis 7** → `localhost:6379`
- **MinIO** → `localhost:9000` (S3), `localhost:9001` (Console)
- **Mailpit** → `localhost:1025` (SMTP), `localhost:8025` (Web UI)

### Запуск API

```bash
dotnet watch run --project src/Sigil.Api
```

Проверка:
```bash
curl http://localhost:5000/health        # → {"status":"ok","service":"sigil-api"}
curl http://localhost:5000/health/live    # → 200
curl http://localhost:5000/health/ready   # → 200 (если PostgreSQL доступен)
```

### Миграции БД

```bash
dotnet ef database update \
  --project src/Sigil.Infrastructure/Sigil.Infrastructure.csproj \
  --startup-project src/Sigil.Api/Sigil.Api.csproj
```

### Тесты

```bash
# Unit-тесты (без Docker)
dotnet test Sigil.slnx --filter "FullyQualifiedName!~DatabaseMigrationTests"

# Все тесты (требует запущенный Docker)
dotnet test Sigil.slnx
```

### Остановка инфраструктуры

```bash
docker compose -f docker-compose.dev.yml down
# С удалением данных:
docker compose -f docker-compose.dev.yml down -v
```

## Структура решения

```
Sigil.slnx
├── src/
│   ├── Sigil.SharedKernel/       # Общие типы (Result<T>, Errors, Money, Email)
│   ├── Sigil.Domain/             # Сущности, value objects, доменные сервисы
│   ├── Sigil.Application/        # Use-cases (commands/queries), интерфейсы
│   ├── Sigil.Infrastructure/     # EF Core, Hangfire, Signer, SMTP, MinIO
│   ├── Sigil.Api/                # ASP.NET Core host, контроллеры, OpenAPI
│   └── Sigil.Client/             # NuGet SDK для клиентских приложений
└── tests/
    ├── Sigil.Domain.Tests/
    ├── Sigil.Application.Tests/
    ├── Sigil.Infrastructure.Tests/   # Integration (Testcontainers)
    ├── Sigil.Api.Tests/              # WebApplicationFactory
    └── Sigil.Client.Tests/
```

## Документация

Полная спецификация — в [`docs/`](docs/):

| Документ | Содержание |
|----------|-----------|
| [00-overview.md](docs/00-overview.md) | Проблема, цели, non-goals, глоссарий |
| [01-architecture.md](docs/01-architecture.md) | Компоненты, потоки данных, деплой |
| [02-data-model.md](docs/02-data-model.md) | Таблицы PostgreSQL, DDL-эскизы |
| [03-licensing-protocol.md](docs/03-licensing-protocol.md) | Ed25519 подпись, формат токена, heartbeat |
| [04-billing.md](docs/04-billing.md) | Планы, подписки, инвойсы |
| [05-web-panel.md](docs/05-web-panel.md) | React SPA, роли, карта страниц |
| [06-api.md](docs/06-api.md) | Panel API + Client API эндпоинты |
| [07-cloudflare-edge.md](docs/07-cloudflare-edge.md) | Edge-only Cloudflare (TLS/WAF/DNS) |
| [08-security.md](docs/08-security.md) | Модель угроз, KMS, аудит |
| [09-tech-stack.md](docs/09-tech-stack.md) | .NET 10, EF Core, React, self-hosted стэк |
| [10-roadmap.md](docs/10-roadmap.md) | Фазы разработки |

## Лицензия

Проприетарное ПО. Все права защищены.
