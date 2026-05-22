# 10 — Дорожная карта

Фазы построены так, что каждая даёт работающий продукт. Можно остановиться на любой и иметь полезное.

## Фаза 0 — Скелет ✅

**Цель:** репозиторий, CI, миграции, "Hello World" health-check.

- [x] Создать solution и проекты (Domain / Application / Infrastructure / Api / Client / SharedKernel + тесты).
- [x] `Sigil.Api` отвечает `200 OK` на `/health`.
- [x] EF Core + Npgsql + первая миграция (расширения `pgcrypto`, `ltree`).
- [x] Docker-compose c Postgres.
- [x] Serilog → stdout, OpenTelemetry заглушка.
- [x] README с инструкцией «как запустить локально».

> CI не нужен — сольный проект.

## Фаза 1 — Ядро лицензирования ✅

**Цель:** можно вручную выпустить лицензию через API, клиент-SDK её проверяет оффлайн.

- [x] Сущности: `Company` (tree), `User`, `LicenseTemplate`, `TemplateVersion`, `SigningKey`, `License`, `LicenseVersion`.
- [x] `EncryptedFileSigner` + master key из env (AES-256-GCM, ключ не покидает `Span<byte>`).
- [x] Panel API: companies CRUD, templates CRUD, licenses CRUD.
- [x] Формат токена (header.payload.signature) + сериализация.
- [x] Подпись Ed25519 через NSec.
- [x] **`Sigil.Client` SDK** (.NET): парсинг, проверка подписи, проверка `exp`, статусы.
- [x] Integration tests с Testcontainers (DatabaseMigrationTests).

> **Долг закрыт в Фазе 2:** `CompanyId` убран из `LicenseTemplate` — шаблоны стали глобальными.

## Фаза 2 — Веб-панель MVP ✅

**Цель:** через UI можно сделать всё, что в Фазе 1 делалось через API. Шаблоны — глобальные.

### Backend

- [x] Cookie-based аутентификация (PBKDF2-SHA256, sliding 7-дневная сессия).
- [x] Seed-оператор `admin@sigil.local` / `changeme` при первом старте.
- [x] Endpoint'ы: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`.
- [x] Companies: `GET`, `POST`, `GET /{id}`, `DELETE /{id}` (soft-archive).
- [x] Templates: полный CRUD + versions (`GET`, `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}`, `GET /{id}/versions`, `POST /{id}/versions`).
- [x] Licenses: `GET`, `POST` (issue + Ed25519 sign), `GET /{id}`, `POST /{id}/revoke`, `GET /{id}/download`, `GET /{id}/public-key`.
- [x] **Рефакторинг: убрать `CompanyId` из `LicenseTemplate`** — сущность, DTO, миграция, репозиторий, сервис, контроллер, фронт.
- [x] CORS через env (`SIGIL_CORS_ORIGINS`), не хардкод.

### Frontend

- [x] Vite + React 19 + TypeScript + shadcn/ui + TanStack Router + TanStack Query + react-hook-form + zod + axios + sonner.
- [x] Auth guard (`_layout.tsx` → `/auth/me` → редирект при 401).
- [x] `/login` — форма входа.
- [x] `/` (Dashboard) — карточки: Companies / Templates / Licenses.
- [x] `/companies` — TreeView с expandable nodes, detail panel, создание дочерней, soft-archive.
- [x] `/templates` — таблица, создание через диалог (без фильтра по компании).
- [x] `/templates/$id` — табы Details / Versions, edit-диалог, archive, создание версии (JSON textarea + Defaults + Changelog).
- [x] `/licenses` — таблица с резолвом company/template. Issue wizard: выбор company + template, JSON config, expiry, offline days. Post-issue экран: license key + token + public key + copy.
- [x] `/licenses/$id` — детали, JSON config viewer, Download `.sigil` / Download Public Key, Revoke, heartbeat timeline.
- [x] `/settings` — заглушка (email, displayName, role, API URL).
- [x] **Рефакторинг: убрать выбор компании при создании шаблона** (templates глобальные).
- [x] `/audit` — страница аудит-лога с фильтрами.
- [ ] Drag-and-drop reparent компаний (отложено).
- [ ] Live-form generator из JSON Schema — сейчас ручной textarea (отложено).
- [ ] OpenAPI генерация + типизированный клиент (orval) (отложено).

## Фаза 3 — Оффлайн + heartbeat ✅

**Цель:** SDK ходит на сервер, получает heartbeat-маркеры, корректно ведёт себя в grace period.

- [x] Client API endpoint'ы: `activate`, `heartbeat`, `deactivate`, `public-key`.
- [x] HMAC-аутентификация запросов.
- [x] Сущности `Activation`, `Heartbeat`.
- [x] Heartbeat-маркер (формат, подпись).
- [x] HW fingerprint provider (Windows + Linux).
- [x] SDK: background heartbeat task, atomic file replace, jitter, retry.
- [x] Тесты: time-tampering (моки часов), сетевые ошибки, revoke.
- [x] Дашборд лицензии: timeline heartbeat'ов, активации.

## Фаза 4 — Webhooks + интеграции ✅

**Цель:** tenant'ы могут подписываться на события и получать их по HTTP.

> Поддомены/Cloudflare-API убраны из плана (см. [07-cloudflare-edge.md](07-cloudflare-edge.md)). Все клиенты ходят к единому хосту `sigil.hizmatrason.tj`.

- [x] Сущности `WebhookEndpoint` + `WebhookDelivery`.
- [x] `WebhookDispatchWorker` (BackgroundService) с retry-стратегией (1m / 5m / 30m / 2h / 12h).
- [x] HMAC-подпись доставок (`X-Sigil-Signature: sha256=<hex>`).
- [x] UI: `/settings/webhooks`, список endpoint'ов, история доставок, replay.
- [x] События: `license.issued`, `license.revoked`, `license.expired`, `license.activated`, `license.heartbeat_missed`.
- [x] Документация для tenant-developer'ов (формат payload + примеры verify) — см. [12-webhooks.md](12-webhooks.md).

## Фаза 5 — Безопасность, ротация, аудит ✅

- [x] Key rotation flow (signing_keys.status трансформации: active / rotating / retired / compromised).
- [x] Audit-лог UI с фильтрами (`/audit` — фильтры по action, actor, entity_kind, time range).
- [x] Security review checklist (CSP, HSTS, secure cookies, rate-limit конфиги).
- [x] Penetration testing (минимум — самопроверка по OWASP ASVS L1).

## Фаза 6 — Production hardening (1–2 недели)

- [ ] Бэкапы PG + учения восстановления.
- [ ] Observability dashboards в Grafana.
- [ ] Alerting (heartbeat success, DNS failures, past_due).
- [ ] Partition'ы `heartbeats`, retention policy.
- [ ] Performance тесты (k6) — пик 5k heartbeat'ов / сек.
- [ ] Документация для tenant'ов (как встроить SDK, как настроить webhook'и).
- [ ] NuGet-публикация `Sigil.Client`.

> Намеренно вычеркнуто из бэклога: Stripe / cloud KMS / Vault / managed PG / Cloudflare-API-DNS — нарушают self-hosted-политику или добавляют лишнюю сложность.

## Ориентир по времени

- Фазы 0–5 — завершены.
- Фаза 6 — Production hardening — в работе.
- Три пункта из Фазы 2 (drag-and-drop reparent, live-form generator из JSON Schema, OpenAPI + orval) отложены в бэклог.
- Биллинг намеренно убран из плана — добавляется позже, когда ядро стабильно.

## Definition of Done для каждой фазы

1. Код покрыт тестами (Domain + Application — >80%, Infra — happy path + edge cases).
2. Документация в `/docs` обновлена.
3. Миграции обратимы (где возможно).
4. Метрики и логи добавлены для новых функций.
5. UI-флоу проверен вручную end-to-end.
6. Аудит-события для новых мутаций пишутся.
7. Релиз с changelog'ом и тегом.
