# 06 — API

Один ASP.NET Core 8 хост, два логически разных API под разными префиксами:

- `/api/v1/panel/*` — для веб-панели и tenant CI-инструментов (session-cookie или PAT в Authorization).
- `/api/v1/client/*` — для клиентского SDK (на стороне продуктов заказчика).

Контент-тайп — `application/json`. OpenAPI 3.1 генерируется автоматически (Swashbuckle или NSwag), панель и сторонние клиенты пользуются им.

## Общие правила

- Все ответы — `application/json`. Ошибки в формате RFC 7807 (`problem+json`).
- Все идентификаторы — UUID v7 в строковом виде.
- Все таймстемпы — ISO 8601 в UTC.
- Пагинация — cursor-based: `?cursor=<opaque>&limit=50` → `{ data: [...], next_cursor: "..." }`.
- Идемпотентность мутирующих client-API endpoint'ов — через заголовок `Idempotency-Key`.
- Rate-limit — `X-RateLimit-*` заголовки; превышение → `429`.
- Request-id — заголовок `X-Request-Id` (пробрасывается в логи).

## Panel API

### Auth

```
POST   /api/v1/panel/auth/login            { email, password } → 200 + cookie
POST   /api/v1/panel/auth/logout           → 204
POST   /api/v1/panel/auth/forgot-password  { email } → 204
POST   /api/v1/panel/auth/reset-password   { token, password } → 204
POST   /api/v1/panel/auth/signup-invite    { token, password, name } → 200
GET    /api/v1/panel/auth/me               → 200 { user, roles, current_company }
POST   /api/v1/panel/auth/switch-company   { company_id } → 200
```

### Companies (tree)

```
GET    /api/v1/panel/companies                       — список доступных
GET    /api/v1/panel/companies/tree?root=<id>        — поддерево
POST   /api/v1/panel/companies                       — создать дочернюю
GET    /api/v1/panel/companies/{id}
PATCH  /api/v1/panel/companies/{id}
DELETE /api/v1/panel/companies/{id}                  — soft-delete (status=archived)
POST   /api/v1/panel/companies/{id}/move             — reparent
POST   /api/v1/panel/companies/{id}/users            — назначить роль
DELETE /api/v1/panel/companies/{id}/users/{userId}
```

### Templates

```
GET    /api/v1/panel/templates
POST   /api/v1/panel/templates
GET    /api/v1/panel/templates/{id}
PATCH  /api/v1/panel/templates/{id}
DELETE /api/v1/panel/templates/{id}                  — soft-delete
POST   /api/v1/panel/templates/{id}/versions         — создать новую версию
GET    /api/v1/panel/templates/{id}/versions
GET    /api/v1/panel/templates/{id}/versions/{ver}
GET    /api/v1/panel/templates/{id}/public-key       — для встраивания в SDK
```

### Licenses

```
GET    /api/v1/panel/licenses?company_id=...&status=...&template_id=...
POST   /api/v1/panel/licenses                        — выпуск
GET    /api/v1/panel/licenses/{id}
PATCH  /api/v1/panel/licenses/{id}                   — изменить config → new version
POST   /api/v1/panel/licenses/{id}/revoke            { reason }
POST   /api/v1/panel/licenses/{id}/reissue           — заново подписать без изменений
GET    /api/v1/panel/licenses/{id}/download          — .sigil file
GET    /api/v1/panel/licenses/{id}/activations
DELETE /api/v1/panel/licenses/{id}/activations/{actId}
GET    /api/v1/panel/licenses/{id}/heartbeats?from=...&to=...
GET    /api/v1/panel/licenses/{id}/versions
POST   /api/v1/panel/licenses/{id}/versions/{ver}/rollback
```

### Billing

```
GET    /api/v1/panel/billing/subscription
POST   /api/v1/panel/billing/subscription/change-plan   { plan_id }
POST   /api/v1/panel/billing/subscription/cancel
GET    /api/v1/panel/billing/invoices
GET    /api/v1/panel/billing/invoices/{id}
GET    /api/v1/panel/billing/invoices/{id}/pdf
GET    /api/v1/panel/plans                              — список доступных тарифов
```

### Audit & Settings

```
GET    /api/v1/panel/audit?entity_kind=...&actor=...&from=...&to=...
GET    /api/v1/panel/settings/api-tokens
POST   /api/v1/panel/settings/api-tokens                — возвращает токен один раз
DELETE /api/v1/panel/settings/api-tokens/{id}
GET    /api/v1/panel/settings/webhooks
POST   /api/v1/panel/settings/webhooks
```

### Operator-only (`/api/v1/panel/operator/*`)

```
GET    /api/v1/panel/operator/companies               — все tenant'ы
POST   /api/v1/panel/operator/plans
PATCH  /api/v1/panel/operator/plans/{id}
POST   /api/v1/panel/operator/companies/{id}/suspend
```

## Client API (для SDK)

Доступ — по **License Key** + **proof-of-possession** (подписанный nonce). Без cookies, всё в headers.

### Аутентификация

Каждый запрос содержит:
- `X-Sigil-License: SGIL-AB12-...`
- `X-Sigil-Timestamp: 1747200000`
- `X-Sigil-Nonce: <hex 16 bytes>`
- `X-Sigil-Signature: <hex>` — HMAC-SHA256 над `method || path || timestamp || nonce || body_sha256`, ключ — `license_key` сам.

Сервер:
1. Находит лицензию по `X-Sigil-License`.
2. Проверяет `|now - timestamp| < 5min`.
3. Verify HMAC.
4. Проверяет nonce в Redis (TTL 10min) — защита от replay.

> Это «proof of license key holder», не «proof of private key holder». Сильнее не нужно: компрометация key = и так доступ к лицензии.

### Endpoint'ы

```
POST   /api/v1/client/activate
       Body: { hw_fingerprint, host, os, client_version }
       → 200 { license_token, heartbeat_token, server_time }
       → 409 если fingerprint занят и не совпадает

POST   /api/v1/client/heartbeat
       Body: { hw_fingerprint, config_version, client_version, metrics? }
       → 200 { server_time, heartbeat_token, license_token?, revoked? }
          - heartbeat_token обновляется всегда
          - license_token — только если config_version устарел
          - revoked: { reason, revoked_at, revocation_token } — если отозвана

GET    /api/v1/client/public-key/{template_id}
       (без auth — для случая, когда клиент потерял встроенный ключ)
       → 200 { public_key, kid, algorithm }

POST   /api/v1/client/deactivate
       Body: { hw_fingerprint }
       → 204 — освобождает слот, удобно для миграции на новый сервер
```

### Поведение клиента (правила)

- Heartbeat — **idempotent**. При сетевой ошибке SDK ретраит с тем же `Idempotency-Key`.
- Если сервер недоступен → SDK молча работает в grace period.
- При первом запуске без `activations` → SDK сам вызывает `activate`.
- Если `revoked` — SDK сохраняет `revocation_token` локально (с подписью Ed25519, не HMAC) и блокирует.

## Webhooks (для tenant'ов)

Tenant в `/settings/webhooks` задаёт endpoint и секрет. Sigil шлёт `POST` с заголовком `X-Sigil-Signature: sha256=<hex>` (HMAC).

События:
- `license.issued`
- `license.revoked`
- `license.expired`
- `license.activated`
- `license.heartbeat_missed` (24ч без heartbeat'а у активной лицензии)
- `subscription.past_due`
- `invoice.paid`

Доставка: at-least-once, с retry'ями (1m, 5m, 30m, 2h, 12h) до 5 попыток. История доставок — в `/settings/webhooks/deliveries`.

## Ошибки (problem+json)

```json
{
  "type": "https://sigil.hizmatrason.tj/errors/plan_quota_exceeded",
  "title": "Plan quota exceeded",
  "status": 403,
  "detail": "Your current plan allows up to 250 active licenses.",
  "code": "plan_quota_exceeded",
  "instance": "/api/v1/panel/licenses",
  "request_id": "01HXY...",
  "context": { "limit": 250, "current": 250 }
}
```

Каталог error code'ов хранится в `Sigil.Domain.Errors` как enum-like static class.

## Версионирование

- Major-версия в URL (`/v1/`). v2 появится только при breaking changes.
- Внутри v1 — добавление новых полей и endpoint'ов не считается breaking.
- Deprecated поля помечаются в OpenAPI (`x-deprecated-since`) и в Sunset-заголовке.
