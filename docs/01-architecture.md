# 01 — Архитектура

## Высокоуровневая схема

```
                 ┌──────────────────────────────────────────────────┐
                 │                  Sigil Control Plane             │
                 │                                                  │
   Operator/     │   ┌──────────────┐    ┌────────────────────┐     │
   Tenant Admin ─┼──▶│   Web Panel   │───▶│  Panel API (REST)  │    │
   (browser)     │   │ (Vite/React)  │    │   ASP.NET Core 8   │    │
                 │   └──────────────┘    └─────────┬──────────┘     │
                 │                                  │                │
                 │                                  ▼                │
                 │   ┌───────────────────────────────────────────┐   │
                 │   │              Application Core             │   │
                 │   │  Companies │ Templates │ Licenses │ Bill. │   │
                 │   └─┬───────────┬───────────┬───────────┬─────┘   │
                 │     │           │           │                     │
                 │     ▼           ▼           ▼                     │
                 │  ┌─────┐  ┌──────────┐ ┌──────────┐               │
                 │  │ DB  │  │  Signer  │ │   Jobs   │               │
                 │  │ PG  │  │ (Ed25519)│ │(Hangfire)│               │
                 │  │     │  │  + Vault │ │          │               │
                 │  └─────┘  └──────────┘ └──────────┘               │
                 └──────────────┬───────────────────────────────────┘
                                │
                                ▼
                 ┌─────────────────────────────────────────┐
                 │           Public Client API             │
                 │   (verify / refresh / heartbeat /       │
                 │     activate / hardware-bind)           │
                 └─────────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                     ▼
       Customer Server      Customer Server       Customer Server
       (Sigil SDK для      (Sigil SDK для         (Sigil SDK для
        .NET-приложения)    .NET-приложения)        .NET-приложения)
        offline-capable     offline-capable        offline-capable
```

## Компоненты

### 1. Web Panel (`sigil-panel`)
- SPA на Vite + React + TS + shadcn/ui + TanStack Query/Router.
- Авторизация через cookie-based session или JWT (`/api/auth`).
- Темы (light/dark), i18n RU/EN.
- Деплой: статика за nginx на той же self-hosted VM.

### 2. Panel API (`Sigil.Api`)
- ASP.NET Core 8, Minimal APIs либо Controllers (на выбор; рекомендую Controllers + MediatR для CQRS).
- Эндпоинты под `/api/v1/panel/*`.
- Авторизация: JWT в HttpOnly cookie + CSRF token, либо OpenIddict с PKCE.
- Роли и пермишены — см. [05-web-panel.md](05-web-panel.md).

### 3. Public Client API (`Sigil.Api`, namespace `/api/v1/client/*`)
- Те же процессы хостят и панельный, и клиентский API, но раздельные группы маршрутов и фильтры аутентификации.
- Авторизация клиентских запросов — по `license_id + signed nonce` (детали в [03](03-licensing-protocol.md) и [06](06-api.md)).
- Идемпотентность heartbeat'ов.

### 4. Application Core (`Sigil.Domain` + `Sigil.Application`)
- Clean-architecture слои:
  - `Sigil.Domain` — сущности, value objects, доменные сервисы (чистый C#, никаких зависимостей).
  - `Sigil.Application` — use-cases (commands/queries), интерфейсы инфраструктуры.
  - `Sigil.Infrastructure` — EF Core, Hangfire jobs, ISigner-реализации (EncryptedFile/Vault), SMTP, MinIO-клиент.
  - `Sigil.Api` — host + контроллеры.

### 5. Signer Service
- Логически отдельный сервис (внутри процесса в v1, выносится позже).
- Хранит **только публичные идентификаторы** ключей; приватники лежат либо в **HashiCorp Vault** (self-hosted), либо в зашифрованном файле + master key из env. Cloud KMS (AWS/Azure/Yandex) **не используем** — всё self-hosted.
- Ed25519 на NSec.Cryptography (быстрее) либо BouncyCastle (универсальнее).
- Каждый шаблон лицензии имеет собственную **подписную keypair** → отзыв компрометированного ключа не ломает остальные продукты.

### 6. Background Jobs (`Sigil.Jobs`)
- Hangfire (или Quartz.NET) с PostgreSQL storage.
- Виды job'ов:
  - `BillingCycleJob` — формирование инвойсов раз в сутки.
  - `LicenseExpiryNotificationJob` — за 30/7/1 день до expiry.
  - `HeartbeatCleanupJob` — TTL для старых heartbeat'ов.
  - `AuditLogArchiverJob` — выгрузка в MinIO раз в месяц.
  - `WebhookDispatchJob` — доставка событий tenant'ам с retry.

> **Поддоменов на лицензию нет.** Все клиентские SDK обращаются к единственному эндпоинту `sigil.hizmatrason.tj` (см. [06-api.md](06-api.md)). Cloudflare-API интеграция отсутствует; Cloudflare используется **только как edge для самого домена Sigil** (TLS, WAF, DNS-записи `api.*` и `panel.*`, заведённые вручную).

### 8. Storage (всё self-hosted)
- **PostgreSQL 16** в контейнере на хост-VM — основное хранилище (см. [02-data-model.md](02-data-model.md)). WAL-архивирование в MinIO для PITR.
- **Redis 7** (self-hosted, опционально) — rate-limit, ephemeral nonces для активации.
- **MinIO** (S3-совместимый, self-hosted) — экспорт лицензий, архив аудит-лога, бэкапы Postgres.

### 9. Client SDK (`Sigil.Client` — отдельный NuGet)
- `dotnet add package Sigil.Client`.
- Минимальный публичный API:
  ```csharp
  var client = new SigilLicenseClient(new SigilOptions {
      LicenseFilePath = "license.sigil",
      PublicKey = embeddedPublicKey,
      ServerUrl = "https://api.sigil.hizmatrason.tj",
      HardwareFingerprintProvider = new DefaultHwfpProvider(),
  });
  await client.InitializeAsync();
  if (!client.Has(Feature.AdvancedReporting)) ...
  ```
- Внутри: парсинг и верификация токена, кеширование state, фоновый heartbeat (раз в 24ч с jitter), persisted last-checkin.

## Потоки данных

### Поток A — Выпуск лицензии
1. Tenant admin в панели нажимает «Issue license» для шаблона T в компании C.
2. Panel API → `IssueLicenseCommand` → доменный сервис.
3. Доменный сервис:
   - валидирует config против JSON Schema шаблона;
   - проверяет квоты подписки;
   - создаёт сущность `License` со статусом `active`;
   - запрашивает у Signer подпись payload'а → получает токен;
   - сохраняет токен в `license_versions` и в БД;
   - публикует событие `LicenseIssued` (для webhook'ов и аудита).
4. В UI пользователь сразу получает кнопку «Скачать .sigil файл» и публичный ключ для встраивания.

### Поток B — Верификация на клиенте (offline)
1. SDK при старте читает файл `license.sigil`.
2. Парсит формат, валидирует подпись публичным ключом.
3. Проверяет:
   - `expires_at > now`;
   - `last_heartbeat_at + grace_period > now`;
   - `hardware_fingerprint` совпадает (если задан).
4. Если ок — продукт работает. Если нет — degraded mode + локальное логирование.

### Поток C — Heartbeat / refresh
1. SDK раз в 24ч (с ±2ч jitter) шлёт `POST /api/v1/client/heartbeat`.
2. Сервер находит лицензию, проверяет revocation, актуальную версию config.
3. Если версия изменилась → возвращает свежий signed token.
4. SDK атомарно заменяет `license.sigil`, обновляет `last_heartbeat_at` (тоже подписанное сервером значение, чтобы клиент не мог его подделать).

### Поток D — Отзыв
1. Tenant admin → «Revoke».
2. `License.status = revoked`, `revoked_at = now`, `revocation_reason = ...`.
3. При следующем heartbeat — клиент получает `403 + revocation_token`.
4. SDK сохраняет revocation locally (с подписью!) и не позволяет «откатить» лицензию заменой файла.

## Деплой (минимум для prod)

```
┌─────────────────────────────────────────────────┐
│                   Cloudflare                    │     ← единственный внешний сервис
│  (proxy, WAF, TLS, поддомены лицензий — DNS)    │
└────────────────────┬────────────────────────────┘
                     │  (origin pull через Cloudflare Tunnel
                     │   или whitelisted egress IP)
                     ▼
        ┌─────────────────────────────────────┐
        │      Self-hosted VM / bare metal    │
        │   (Linux, docker-compose / k3s)     │
        │                                     │
        │  ┌───────────┐    ┌───────────┐     │
        │  │  panel.   │    │   api.    │     │
        │  │ sigil.*   │    │  sigil.*  │     │
        │  │  (nginx   │    │  (.NET    │     │
        │  │ + статика)│    │  Kestrel) │     │
        │  └───────────┘    └─────┬─────┘     │
        │                          │           │
        │                  ┌───────┴─────┐     │
        │                  ▼             ▼     │
        │            ┌──────────┐  ┌────────┐  │
        │            │ Postgres │  │ Redis  │  │
        │            │   16     │  │  7     │  │
        │            │ (Docker) │  │(Docker)│  │
        │            └────┬─────┘  └────────┘  │
        │                 │                    │
        │                 ▼                    │
        │           ┌──────────┐  ┌─────────┐  │
        │           │  MinIO   │  │  Vault  │  │
        │           │ (WAL+    │  │(secrets │  │
        │           │ archives)│  │ + keys) │  │
        │           └──────────┘  └─────────┘  │
        └─────────────────────────────────────┘
```

- Один VM/контейнер на API (горизонтально масштабируется stateless'ом, если поднять второй хост).
- Один Hangfire worker (или внутри того же процесса с лимитом thread'ов).
- Postgres — **self-hosted в Docker** на той же VM (или отдельной); ежедневные `pg_basebackup` + continuous WAL → MinIO; PITR из MinIO.
- Secrets — Vault или encrypted-file + master key из переменной окружения (загружается, например, через docker secret / systemd EnvironmentFile). Никаких облачных KMS.
- TLS: Cloudflare держит edge-сертификаты на `*.sigil.<base>`; origin — либо Cloudflare Tunnel (`cloudflared`), либо собственный сертификат Let's Encrypt + IP allow-list на firewall'е, разрешающий только IP-диапазоны Cloudflare.

## Что вынесем в отдельные сервисы позже

- Signer Service → отдельный процесс с доступом к Vault Transit или PKCS#11 HSM (когда придёт enterprise-клиент).
- Public Client API → отдельный контейнер с собственным rate-limit (если нагрузка от SDK heartbeat'ов станет ≫ панели).
- Billing → отдельный сервис при сложной тарификации.
