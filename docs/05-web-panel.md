# 05 — Веб-панель

Vite + React 18 + TypeScript + shadcn/ui + Tailwind. Один SPA-bundle, маршрутизация — TanStack Router, данные — TanStack Query, формы — react-hook-form + zod, таблицы — TanStack Table.

## Структура приложения

```
src/
  app/
    router.tsx              # tree TanStack Router
    providers.tsx           # QueryClient, ThemeProvider, AuthProvider
  features/
    auth/
    companies/              # дерево компаний, CRUD
    templates/              # шаблоны + редактор JSON Schema
    licenses/               # выпуск, обзор, edit, revoke
    billing/                # планы, подписки, инвойсы
    audit/                  # просмотр аудит-лога
    operator/               # /operator/* — для сотрудников Sigil
    settings/               # users, roles, API tokens
  components/               # переиспользуемые ui (поверх shadcn)
  lib/
    api/                    # сгенерированный из OpenAPI клиент (orval / openapi-ts)
    crypto/                 # клиентская валидация Ed25519 (для проверки выгружаемых лицензий)
    forms/                  # field-resolver'ы для JSON Schema → react-hook-form
  styles/
```

## Роли и пермишены

| Роль | Скоуп | Что может |
|------|-------|-----------|
| **Operator** (Sigil staff) | глобально | всё, кроме чужих секретов; видит все компании |
| **Owner** | конкретная компания | создание/удаление потомков, биллинг, все шаблоны и лицензии своего поддерева |
| **Admin** | конкретная компания | CRUD шаблонов и лицензий, но без биллинга и удаления компании |
| **Billing** | конкретная компания | только биллинг (планы, инвойсы, payment methods) |
| **Viewer** | конкретная компания | read-only |

Назначение роли на узел дерева → доступ распространяется на всех потомков. В UI явно показываем «inherited from <CompanyName>».

## Карта страниц

```
/login                           — публичный
/signup/invite/:token            — публичный
/forgot-password                 — публичный

# Внутри tenant-контекста (выбирается в Sidebar)
/                                — Dashboard
/companies                       — дерево компаний (TreeView)
/companies/:id                   — детали компании, дети, пользователи
/companies/:id/edit
/companies/:id/users             — назначение ролей

/templates                       — список шаблонов
/templates/new                   — мастер создания
/templates/:id                   — обзор + версии
/templates/:id/edit              — редактор (JSON Schema + базовые поля)
/templates/:id/versions          — diff между версиями

/licenses                        — таблица всех лицензий (с фильтрами)
/licenses/new                    — выбор шаблона → форма по schema → выпуск
/licenses/:id                    — детали, активации, heartbeats, история конфига
/licenses/:id/edit               — изменение config → новая version + re-sign
/licenses/:id/revoke             — диалог с причиной

/billing                         — текущий план
/billing/plans                   — выбор/смена плана
/billing/invoices                — список инвойсов
/billing/invoices/:id            — PDF preview + статус оплаты
/billing/payment-methods

/audit                           — таймлайн событий, фильтры

/settings/profile
/settings/api-tokens             — токены доступа к API (для CI/automation)
/settings/webhooks               — endpoint URLs, secret, события

# Operator (только для Sigil staff)
/operator                        — обзор всех tenant'ов
/operator/companies
/operator/plans                  — управление прайсами
/operator/feature-flags
```

## Ключевые экраны (детализация)

### 1. Дерево компаний (`/companies`)

- Слева — `TreeView` (collapsible nodes), drag-and-drop для reparent'а (только Owner).
- Справа — детали выделенной компании: status, ссылки на шаблоны/лицензии/пользователей, agg-метрики.
- Кнопка «+ дочерняя компания» открывает Sheet с формой.
- Breadcrumbs показывают полный путь.

### 2. Редактор шаблона (`/templates/:id/edit`)

Самый сложный экран. Tabs:

1. **General** — name, product_code, description, status, дефолтные `validity_days` и `offline_days`.
2. **Config Schema** — Monaco-editor с JSON Schema; live-preview формы (рендерится тем же resolver'ом, что и при выпуске лицензии).
3. **Defaults** — заполненный пример config'а (валидируется против schema на лету).
4. **Cryptography** — выбор signing key (existing / generate new), download public key.
5. **Versions** — список version'ов, diff side-by-side.

Сохранение → `POST /templates/:id/versions` → создаётся новая версия, current_version_id указывает на неё. Существующие лицензии остаются на старой версии до явной миграции.

### 3. Выпуск лицензии (`/licenses/new`)

Wizard:

1. Выбор шаблона (из доступных).
2. Выбор компании-владельца (можно из текущего поддерева).
3. **Форма по schema** (auto-generated):
   - shadcn компоненты по типам (string → Input, boolean → Switch, array → repeater, enum → Select).
   - Зависимые поля через JSON Schema `dependencies`.
   - Live-валидация zod, синхронизированная со schema.
4. Дополнительные поля: `expires_at`, `offline_days` (preset/custom), `hw_fingerprint` mode (`none` / `pin_on_first_activation` / `pin_now`).
5. Preview итогового payload в read-only режиме.
6. «Issue» → server signs, возвращает токен + ссылку на скачивание `.sigil` файла + публичный ключ.

### 4. Детали лицензии (`/licenses/:id`)

- Заголовок: статус (badge), expires in N days, last heartbeat M minutes ago.
- Tabs:
  - **Overview** — конфиг (collapsed JSON), действия (Edit / Revoke / Download / Reissue).
  - **Activations** — таблица HW fingerprint'ов с возможностью deactivate.
  - **Heartbeats** — chart (по часам) + последние 100 записей.
  - **Versions** — история, diff, кнопка «Rollback».
  - **Audit** — события, специфичные для этой лицензии.

### 5. Аудит-лог (`/audit`)

- Виртуализированная таблица (TanStack Virtual).
- Фильтры: actor, entity_kind, action, time range, company subtree.
- Клик по строке → drawer с before/after diff.

## Auth-флоу

1. `/login` → `POST /api/v1/panel/auth/login { email, password }` → HttpOnly cookie + CSRF token в response.
2. Каждый запрос через axios-instance с `X-CSRF-Token` из mem-storage.
3. 401 → редирект на `/login` с возвратом по `?redirect=`.
4. Refresh — sliding session, продлевается при активности.
5. Invite-флоу: оператор/owner отправляет invite → email с `/signup/invite/:token` → форма установки пароля.

## Уведомления

- Toast (sonner) для async-операций.
- Banner сверху, если у tenant'а: trial ends in N days, plan past_due, expired licenses > 0.
- Опционально SignalR для real-time обновления статуса лицензии (после revoke / DNS done).

## Состояния и UX-детали

- **Skeleton loaders** на всех таблицах и cards.
- **Optimistic updates** при revoke / edit.
- **Confirm dialog** на любые destructive операции с типизацией названия объекта.
- **Empty states** с понятной CTA («У вас нет ни одного шаблона — создать первый?»).
- **Темы** через CSS-variables shadcn; default — system.
- **Локализация:** i18next с RU/EN; ключи в `locales/{lang}/{namespace}.json`.

## Доступ через API token

В `/settings/api-tokens` пользователь создаёт PAT с правами в рамках своей роли и scope (одна компания + потомки). Токен показывается один раз. Используется для CI-pipelines (например, автовыпуск лицензий из CD).
