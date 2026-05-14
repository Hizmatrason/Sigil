# 10 — Дорожная карта

Фазы построены так, что каждая даёт работающий продукт. Можно остановиться на любой и иметь полезное.

## Фаза 0 — Скелет (1 неделя)

**Цель:** репозиторий, CI, миграции, "Hello World" health-check.

- [x] Создать solution и проекты (Domain / Application / Infrastructure / Api / Client / SharedKernel + тесты).
- [x] `Sigil.Api` отвечает `200 OK` на `/health`.
- [x] EF Core + Npgsql + первая миграция (расширения `pgcrypto`, `ltree`).
- [x] Docker-compose c Postgres.
- [ ] CI (Gitea Actions / self-hosted): build + unit tests + docker build. // Не нужно
- [x] Serilog → stdout, OpenTelemetry заглушка.
- [x] README с инструкцией «как запустить локально».

## Фаза 1 — Ядро лицензирования (2–3 недели)

**Цель:** можно вручную выпустить лицензию через API, клиент-SDK её проверяет оффлайн.

- [ ] Сущности: `Company` (tree), `User`, `LicenseTemplate`, `TemplateVersion`, `SigningKey`, `License`, `LicenseVersion`.
- [ ] `EncryptedFileSigner` + master key из env.
- [ ] Endpoint'ы Panel API: companies CRUD, templates CRUD, licenses CRUD (без UI, через curl/Postman).
- [ ] Формат токена (header.payload.signature) + сериализация.
- [ ] Подпись Ed25519 через NSec.
- [ ] **`Sigil.Client` SDK** (.NET): парсинг, проверка подписи, проверка `exp`, статусы.
- [ ] Простейший консольный sample-проект, демонстрирующий проверку.
- [ ] Unit tests на signer + SDK (golden vectors).
- [ ] Integration tests с Testcontainers.

## Фаза 2 — Веб-панель MVP (3–4 недели)

**Цель:** через UI можно сделать всё, что в Phase 1 делалось через API.

- [ ] React/Vite-приложение, аутентификация (login/logout, ASP.NET Identity + cookie).
- [ ] Дерево компаний (TreeView, CRUD, drag-and-drop для reparent).
- [ ] Список и редактор шаблонов (Monaco для JSON Schema).
- [ ] Live-form generator из JSON Schema (rjsf или собственная обёртка над react-hook-form/zod).
- [ ] Выпуск лицензии (wizard), детали лицензии, revoke.
- [ ] Download `.sigil` файла и public key.
- [ ] Базовый audit-лог (запись + чтение).
- [ ] OpenAPI генерация + типизированный клиент (orval).
- [ ] Smoke e2e на Playwright: создать tenant → шаблон → лицензию → revoke.

## Фаза 3 — Оффлайн + heartbeat (1–2 недели)

**Цель:** SDK ходит на сервер, получает heartbeat-маркеры, корректно ведёт себя в grace period.

- [ ] Client API endpoint'ы: `activate`, `heartbeat`, `deactivate`, `public-key`.
- [ ] HMAC-аутентификация запросов.
- [ ] Сущности `Activation`, `Heartbeat`, `dns_records` (запишем заранее).
- [ ] Heartbeat-маркер (формат, подпись).
- [ ] HW fingerprint provider (Windows + Linux).
- [ ] SDK: background heartbeat task, atomic file replace, jitter, retry.
- [ ] Тесты: time-tampering (моки часов), сетевые ошибки, revoke.
- [ ] Дашборд лицензии: график heartbeat'ов, активации.

## Фаза 4 — Webhooks + интеграции (1 неделя)

**Цель:** tenant'ы могут подписываться на события и получать их по HTTP.

> Поддомены/Cloudflare-API убраны из плана (см. [07-cloudflare-edge.md](07-cloudflare-edge.md)). Все клиенты ходят к единому хосту `sigil.hizmatrason.tj`.

- [ ] Сущность `webhook_endpoints` + `webhook_deliveries`.
- [ ] `WebhookDispatchJob` (Hangfire) с retry-стратегией (1m / 5m / 30m / 2h / 12h).
- [ ] HMAC-подпись доставок (`X-Sigil-Signature`).
- [ ] UI: `/settings/webhooks`, список endpoint'ов, история доставок, replay.
- [ ] События: `license.issued`, `license.revoked`, `license.expired`, `license.activated`, `subscription.past_due`, `invoice.paid`.
- [ ] Документация для tenant-developer'ов (формат payload + примеры verify).

## Фаза 5 — Биллинг v1 (2 недели)

**Цель:** планы, подписки, ручные инвойсы.

- [ ] Сущности `Plan`, `Subscription`, `Invoice`, `InvoiceLine`.
- [ ] `EntitlementService`, проверка лимитов перед мутациями.
- [ ] `BillingCycleJob` — генерация инвойсов раз в сутки.
- [ ] PDF через QuestPDF.
- [ ] UI: `/billing/*`, баннеры trial/past_due.
- [ ] Operator UI для управления планами и ручной отметки `paid`.
- [ ] Webhook'и (`license.*`, `subscription.*`).

## Фаза 6 — Безопасность, ротация, аудит (1–2 недели)

- [ ] 2FA (TOTP) для operator-аккаунтов.
- [ ] API tokens (PAT) с scoped permissions.
- [ ] Key rotation flow (signing_keys.status трансформации).
- [ ] Audit-лог UI с фильтрами и diff-viewer.
- [ ] Security review checklist (CSP, HSTS, secure cookies, rate-limit конфиги).
- [ ] Penetration testing (минимум — самопроверка по OWASP ASVS L1).

## Фаза 7 — Production hardening (1–2 недели)

- [ ] Бэкапы PG + учения восстановления.
- [ ] Observability dashboards в Grafana.
- [ ] Alerting (heartbeat success, DNS failures, past_due).
- [ ] Partition'ы `heartbeats`, retention policy.
- [ ] Performance тесты (k6) — пик 5k heartbeat'ов / сек.
- [ ] Документация для tenant'ов (как встроить SDK, как настроить webhook'и).
- [ ] NuGet-публикация `Sigil.Client`.

## После MVP (по приоритету)

1. **HashiCorp Vault Transit** для signing keys (вместо EncryptedFileSigner).
2. **Банковский reconciliation-импорт** (CSV из 1С/банк-клиента) для авто-отметки оплат.
3. **OpenIddict** + внутренний IdP для SSO между tenant'ами.
4. **Sub-billing для tenant'ов** (white-label инвойсы конечным клиентам).
5. **Mobile SDK** (Java/Kotlin, Swift) — если будут запросы.
6. **License analytics** — usage heatmaps, geo-распределение, аномалии.
7. **Marketplace шаблонов** между tenant'ами.
8. **HSM / PKCS#11** для enterprise.

> Намеренно вычеркнуто из бэклога: Stripe / cloud KMS / managed PG / Cloudflare-API-DNS — нарушают self-hosted-политику.

## Ориентир по времени

- **Сольный разработчик full-time:** Фазы 0–7 → ~16–18 недель до production-ready MVP.
- **Команда 2–3 человек:** ~10 недель.
- Можно срезать: Фаза 5 (биллинг) и Фаза 4 (DNS) — параллельно с другими, если разработчиков несколько.

## Definition of Done для каждой фазы

1. Код покрыт тестами (Domain + Application — >80%, Infra — happy path + edge cases).
2. Документация в `/docs` обновлена.
3. Миграции обратимы (где возможно).
4. Метрики и логи добавлены для новых функций.
5. UI-флоу проверен вручную end-to-end.
6. Аудит-события для новых мутаций пишутся.
7. Релиз с changelog'ом и тегом.
