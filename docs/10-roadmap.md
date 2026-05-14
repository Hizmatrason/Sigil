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

- [x] Сущности: `Company` (tree), `User`, `LicenseTemplate`, `TemplateVersion`, `SigningKey`, `License`, `LicenseVersion`.
- [x] `EncryptedFileSigner` + master key из env.
- [x] Endpoint'ы Panel API: companies CRUD, templates CRUD, licenses CRUD (без UI, через curl/Postman).
- [x] Формат токена (header.payload.signature) + сериализация.
- [x] Подпись Ed25519 через NSec.
- [x] **`Sigil.Client` SDK** (.NET): парсинг, проверка подписи, проверка `exp`, статусы.
- [ ] Простейший консольный sample-проект, демонстрирующий проверку.
- [ ] Unit tests на signer + SDK (golden vectors) — не делаем (решение: без unit-тестов).
- [x] Integration tests с Testcontainers (DatabaseMigrationTests).

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

## Фаза 5 — Безопасность, ротация, аудит (1–2 недели)

- [ ] Key rotation flow (signing_keys.status трансформации).
- [ ] Audit-лог UI с фильтрами и diff-viewer.
- [ ] Security review checklist (CSP, HSTS, secure cookies, rate-limit конфиги).
- [ ] Penetration testing (минимум — самопроверка по OWASP ASVS L1).

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

- **Сольный разработчик full-time:** Фазы 0–7 → ~16–18 недель до production-ready MVP.
- **Команда 2–3 человек:** ~10 недель.
- Фаза биллинга намеренно убрана из плана — добавляется позже, когда ядро стабильно.

## Definition of Done для каждой фазы

1. Код покрыт тестами (Domain + Application — >80%, Infra — happy path + edge cases).
2. Документация в `/docs` обновлена.
3. Миграции обратимы (где возможно).
4. Метрики и логи добавлены для новых функций.
5. UI-флоу проверен вручную end-to-end.
6. Аудит-события для новых мутаций пишутся.
7. Релиз с changelog'ом и тегом.
