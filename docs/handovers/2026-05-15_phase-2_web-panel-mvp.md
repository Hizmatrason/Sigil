# Handover — Phase 2: Web Panel MVP

**Дата:** 2026-05-15  
**Roadmap:** [Фаза 2 — Веб-панель MVP](../10-roadmap.md)

## Что сделано

### Backend (.NET 10)

- **Аутентификация:** cookie-based auth (`sigil.auth`), PBKDF2-SHA256 (600k итераций), sliding 7-дневная сессия. Seed-operator `admin@sigil.local` / `changeme` создаётся на старте.
- **Panel API endpoints** (все под `/api/v1/panel`):
  - `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
  - `GET /companies`, `POST /companies`, `GET /companies/{id}`, `DELETE /companies/{id}` (soft-archive)
  - `GET /templates` (optional `?companyId`), `POST /templates`, `GET /templates/{id}`, `PUT /templates/{id}`, `DELETE /templates/{id}` (soft-archive)
  - `GET /templates/{id}/versions`, `POST /templates/{id}/versions`
  - `GET /licenses` (optional `?companyId`), `POST /licenses` (issue), `GET /licenses/{id}`, `POST /licenses/{id}/revoke`
  - `GET /licenses/{id}/download` — blob `.sigil` файл (`LicenseKey`, `Token`, `PublicKey` в JSON)
  - `GET /licenses/{id}/public-key` — hex строка Ed25519 public key
- **CORS:** разрешён `http://localhost:5173` для dev-сервера панели.

### Frontend (Vite + React 19 + TypeScript 5)

- **Техстек:** shadcn/ui + Tailwind v3 + TanStack Router (file-based) + TanStack Query + react-hook-form + zod + axios + sonner (toasts).
- **Auth guard:** `_layout.tsx` проверяет `/auth/me` через `queryClient.fetchQuery`, редирект на `/login` при 401.
- **Login page:** форма с email/password, редирект на `/` после успеха.
- **Dashboard (`/`):** карточки с количеством Companies / Templates / Licenses.
- **Companies (`/companies`):** дерево с expandable nodes, detail panel справа, создание дочерней компании, soft-archive с подтверждением.
- **Templates (`/templates`):** таблица с product code, offline/validity днями, статусом (badge). Создание через диалог с dropdown выбором компании.
- **Template Detail (`/templates/$id`):** табы Details / Versions. Edit-диалог, Archive-диалог, создание версии с JSON Schema + Defaults + Changelog.
- **Licenses (`/licenses`):** таблица с company/template name resolution. Issue wizard: dropdown company + template, JSON config editor, expiry, offline days. После issue — экран с license key, signed token, public key + copy-to-clipboard.
- **License Detail (`/licenses/$id`):** детали, JSON config viewer, кнопки Download `.sigil` / Download Public Key, Revoke с подтверждением.
- **Settings (`/settings`):** placeholder — account info (email, displayName, role) + system info (версия, API URL).
- **Toasts:** все мутации (create/update/archive/issue/revoke/version) показывают `toast.success`/`toast.error` через sonner.

### Новые компоненты

- `alert-dialog.tsx` — shadcn/ui Alert Dialog (Radix)
- `textarea.tsx` — shadcn/ui Textarea

### Сборка

- Backend: `dotnet build` — 0 ошибок, 0 предупреждений
- Frontend: `npx tsc --noEmit` — 0 ошибок, `npx vite build` — успех

## Известные ограничения и TODO

1. **Audit log UI** — entity `AuditLog` есть в Domain, но нет API и frontend страницы. Roadmap Phase 6.
2. **JSON Schema live-form generator** — пока ручной JSON в textarea. Roadmap Phase 2: «Live-form generator из JSON Schema».
3. **Drag-and-drop reparent companies** — не реализовано. Roadmap Phase 2.
4. **OpenAPI + типизированный клиент (orval)** — не настроено. Roadmap Phase 2.
5. **Playwright e2e** — нет. Roadmap Phase 2.
6. **Unit/integration тесты** — решено не делать на этом этапе.

## Как запустить

1. PostgreSQL 17 локально: база `sigil`, пользователь `sigil`/`sigil_dev`.
2. `SIGIL_MASTER_KEY` — 64 hex-символа (32 байта) в переменных окружения.
3. `cd src/Sigil.Api && dotnet run` — API на `http://localhost:5217`.
4. `cd panel && npm run dev` — панель на `http://localhost:5173`.
5. Логин: `admin@sigil.local` / `changeme`.

## Следующая фаза

**Phase 3 — Оффлайн + heartbeat:** Client API endpoints (`activate`, `heartbeat`, `deactivate`), HMAC-аутентификация, heartbeat-маркеры, SDK background task.
