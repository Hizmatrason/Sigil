# 09 — Стек и инфраструктура

## Backend

### Языки и фреймворки
- **.NET 10** (LTS), C# `latest` (via `LangVersion`).
- **ASP.NET Core 10** — Controllers + Minimal APIs гибрид. Controllers для панели, Minimal APIs для client-API (он крошечный, ~5 endpoint'ов).
- **EF Core 8** + **Npgsql.EntityFrameworkCore.PostgreSQL**.
- **MediatR** — CQRS-like разделение команд/запросов (опционально, но рекомендую — упрощает тесты).
- **FluentValidation** — валидация входящих DTO.
- **AutoMapper** или ручные mapper'ы (для маленького проекта ручные часто лучше).
- **Serilog** + sinks: Console (JSON в prod), Seq/Loki локально.
- **OpenTelemetry** — traces + metrics, экспорт в OTLP collector.

### Криптография
- **NSec.Cryptography** — managed-обёртка над libsodium, простая API, Ed25519 из коробки.
- **System.Security.Cryptography** — AES-GCM, HMAC, SHA-256, Argon2id (через `Konscious.Security.Cryptography.Argon2`).
- При необходимости PKCS#11 — `Pkcs11Interop`.

### Background jobs
- **Hangfire** + `Hangfire.PostgreSql` — лучший UX, есть dashboard, persistence в той же БД.
- Альтернатива: **Quartz.NET** — мощнее для cron-выражений, но менее удобный для ad-hoc job'ов.
- Если уйдём в Kubernetes сценарий — заменим на **NServiceBus** или Kafka-based pipeline.

### HTTP-клиенты
- **Refit** на случай, если в будущем понадобятся интеграции (например, в Vault HTTP API). Для самого Sigil v1 — почти не нужен.
- **Polly** для retry / circuit-breaker / timeout / bulkhead.
- **VaultSharp** — клиент к HashiCorp Vault (если используется `VaultSigner`).

### Биллинг
- **QuestPDF** для PDF-инвойсов (полностью offline-генерация).
- Никаких SaaS-провайдеров (Stripe и т.п.) — см. [04-billing.md](04-billing.md).

### Auth панели
- В v1: ASP.NET Core Identity + cookie + Argon2id.
- В v1.5: **OpenIddict** для OIDC/OAuth — внутренний IdP, **self-hosted**. SSO к внешним провайдерам (Entra/Google) — опционально, только если конкретный tenant запросит.

### Тестирование
- **xUnit** + **FluentAssertions**.
- **Testcontainers** для интеграционных тестов с реальной PostgreSQL.
- **WireMock.Net** для mock'а HTTP-зависимостей в тестах (Vault и т.п.).
- **NetArchTest** для проверки архитектурных границ слоёв (Domain не зависит от Infra и т.п.).
- Coverage не самоцель; добиваемся высокого покрытия Domain и Application, остальное — по месту.

### Проект структура (solution)

```
Sigil.sln
  src/
    Sigil.Domain/                # сущности, value objects, доменные события, интерфейсы репозиториев
    Sigil.Application/           # use-cases (commands/queries/handlers), интерфейсы инфраструктуры
    Sigil.Infrastructure/        # EF Core, Hangfire, Vault/SMTP clients, ISigner импл.
    Sigil.Api/                   # ASP.NET host, контроллеры, middleware, OpenAPI
    Sigil.Jobs/                  # (можно слить с Infrastructure) определения Hangfire job'ов
    Sigil.Client/                # NuGet-пакет SDK
    Sigil.SharedKernel/          # общие примитивы (Result<T>, Errors, типы Money/Email)
  tests/
    Sigil.Domain.Tests/
    Sigil.Application.Tests/
    Sigil.Infrastructure.Tests/  # integration (testcontainers)
    Sigil.Api.Tests/             # WebApplicationFactory
    Sigil.Client.Tests/
```

## Frontend

### Стек
- **Vite** + **React 18** + **TypeScript 5**.
- **shadcn/ui** (Radix + Tailwind), Tailwind v3.
- **TanStack Router** (file-based routing) или **React Router** v6 — на выбор; рекомендую TanStack Router (type-safe routes).
- **TanStack Query** — server state.
- **react-hook-form** + **zod** — формы.
- **TanStack Table** + **TanStack Virtual** — таблицы.
- **lucide-react** — иконки (входит в shadcn).
- **sonner** — toasts.
- **Monaco Editor** — JSON Schema editor + diff viewer.
- **i18next** — локализация.
- **orval** или **openapi-typescript** + **openapi-fetch** — генерация типизированного клиента из OpenAPI.

### Тестирование
- **Vitest** для unit/integration.
- **Playwright** для e2e (минимум — happy paths панели).
- **MSW** для mock'а API в Storybook и dev.

## Хранилища (всё self-hosted)

- **PostgreSQL 16** — основное, **в Docker** на хост-VM (или на отдельной — managed не используем).
  - Расширения: `pgcrypto`, `ltree`, `pg_stat_statements`, `pg_partman` (для партиций `heartbeats`).
  - WAL archiving + ежедневный `pg_basebackup` → MinIO для PITR.
- **Redis 7** — опционально, в Docker:
  - rate-limit (через `RedisRateLimiting` Microsoft пакет).
  - кеш активаций / nonce'ов.
  - distributed locks для Hangfire-cluster (если будет много worker'ов).
- **MinIO** — S3-совместимое объектное хранилище в Docker (бэкапы Postgres, архив аудит-лога, экспорт инвойсов, артефакты).
- **HashiCorp Vault** — опционально, в Docker (Transit Engine для подписи + KV для секретов).

## Инфраструктура / DevOps (полностью self-hosted)

### Деплой v1 (минимум)

- **Docker + docker-compose** на одной Linux-VM (Debian/Ubuntu LTS).
- Контейнеры: `sigil-api`, `sigil-jobs` (тот же image, другая роль через env), `postgres`, `redis`, `minio`, `vault` (опц.), `nginx` (reverse proxy + статика панели), `cloudflared` (опционально — origin за Cloudflare Tunnel).
- Один процесс хост-OS, обновления через `docker compose pull && docker compose up -d`.
- Cloudflare используется **только как edge** (TLS/WAF/DNS-зона домена), без API-интеграции. См. [07-cloudflare-edge.md](07-cloudflare-edge.md).

### Деплой v2 (когда понадобится)

- **k3s** или **k0s** — self-hosted Kubernetes на нескольких VM, без managed control-plane.
- Helm chart `sigil/sigil` (поставляется из собственного chart-repo, хостится через nginx + chartmuseum или прямо в MinIO).
- Postgres operator (CloudNativePG) + WAL архив в MinIO для PITR.
- Cert-manager + internal CA или Cloudflare Origin Certificate.

### CI/CD

- **Gitea Actions** или **self-hosted GitHub Actions runners** на отдельной build-VM (без cloud-runners). Можно Drone CI / Woodpecker.
- Pipeline:
  1. Restore + build (`dotnet build`).
  2. Lint (`dotnet format --verify-no-changes`, eslint, prettier).
  3. Unit + integration tests (с testcontainers).
  4. Docker build → push в **self-hosted registry** (Harbor / Gitea built-in / Docker Registry v2 за nginx).
  5. Migration apply (через job на target VM).
  6. Deploy: SSH + `docker compose pull && up -d` (staging auto, prod manual approve).
- Releases — semver tags. `Sigil.Client` NuGet публикуется в **self-hosted NuGet feed** (BaGet или Gitea NuGet); на nuget.org публикуем только если решим открыть SDK публично.

### Observability (всё self-hosted)

- **Logs:** Serilog JSON → stdout → **Loki** (контейнер) → **Grafana**.
- **Metrics:** OpenTelemetry → **Prometheus** → Grafana. Кастомные:
  - `sigil_licenses_issued_total{template,tenant}`
  - `sigil_heartbeats_total{result}`
  - `sigil_signature_duration_seconds`
  - `sigil_webhook_deliveries_total{event,status}`
- **Traces:** OTLP → **Tempo** или **Jaeger**.
- **Alerting:** Grafana Alerting → self-hosted Telegram-бот или собственный SMTP. Никаких PagerDuty/Opsgenie.
  - Heartbeat success ratio < 99% за 10 мин.
  - Webhook delivery failures > N/min.
  - Subscription past_due ratio > 5%.

### Email

- **Self-hosted SMTP** (Postfix контейнер) или **Mailcow** на отдельной VM, если объёмов много.
- Для дев-окружения — Mailpit в docker-compose.
- Никаких SendGrid / Mailgun / Postmark.

### Backups

- PG: ежедневные `pg_basebackup` + continuous WAL → MinIO. Перед загрузкой бэкап шифруется (age или gpg) симметричным ключом, хранящимся отдельно от MinIO.
- MinIO сам реплицируется на второй хост (или на USB-диск через `mc mirror`) — это «копия копии», off-site.
- Сценарий disaster-recovery: RPO 1 час, RTO 4 часа.
- Раз в квартал — учения восстановления (поднимаем staging из бэкапа).

## Локальная разработка

- `docker-compose.dev.yml` поднимает: Postgres + Redis + MinIO + Mailpit + Vault (dev-mode) + (опц.) Seq.
- `dotnet watch run --project src/Sigil.Api`.
- `pnpm dev --filter sigil-panel`.
- Seed-скрипт создаёт оператора, демо-tenant, демо-шаблон, демо-лицензию.

## Что осознанно НЕ берём

- **Cloud KMS / managed databases / SaaS biller'ы** — нарушают self-hosted-политику.
- **GraphQL** — лишний слой для CRUD-панели.
- **Event sourcing** — простая реляционная модель достаточна.
- **Microservices** в день первый — монолит с чистыми границами, выделяем по мере необходимости.
- **NoSQL** — JSON-поля в Postgres покрывают гибкую конфигурацию.
