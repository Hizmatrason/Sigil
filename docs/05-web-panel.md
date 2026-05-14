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
    templates/              # глобальные шаблоны + редактор JSON Schema
    licenses/               # выпуск, обзор, edit, revoke
    audit/                  # просмотр аудит-лога
    operator/               # /operator/* — для сотрудников Sigil
    settings/               # users, roles, API tokens, webhooks
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
| **Operator** (Sigil staff) | глобально | всё; видит все компании; создаёт/редактирует глобальные шаблоны |
| **Owner** | конкретная компания | создание/удаление потомков, все лицензии своего поддерева, управление пользователями |
| **Admin** | конкретная компания | CRUD лицензий, но без удаления компании |
| **Viewer** | конкретная компания | read-only |

Назначение роли на узел дерева → доступ распространяется на всех потомков. В UI явно показываем «inherited from <CompanyName>».

Шаблоны — глобальные и доступны для чтения всем авторизованным пользователям. Создавать и редактировать шаблоны может только Operator.

## Карта страниц (полная)

### Публичные (без auth)

```
/login
/forgot-password
/reset-password/:token
/signup/invite/:token
```

### Основное приложение (авторизованные)

```
/                                — Dashboard
/companies                       — дерево компаний
/companies/:id                   — детали компании
/companies/:id/users             — пользователи и роли
/templates                       — глобальный список шаблонов
/templates/new                   — создание шаблона (только Operator)
/templates/:id                   — обзор шаблона, список версий
/templates/:id/edit              — редактор шаблона (только Operator)
/templates/:id/versions/:ver     — просмотр конкретной версии + diff
/licenses                        — таблица всех лицензий
/licenses/new                    — wizard выпуска лицензии
/licenses/:id                    — детали лицензии (tabs)
/licenses/:id/edit               — изменение config
/audit                           — аудит-лог
/settings/profile                — профиль, смена пароля
/settings/api-tokens             — PAT токены
/settings/webhooks               — webhook endpoints
```

### Operator (только Sigil staff)

```
/operator                        — глобальный дашборд tenant'ов
/operator/companies              — список всех компаний
/operator/templates              — управление глобальными шаблонами
/operator/feature-flags          — флаги фич
```

---

## Детальный план каждой страницы

### `/login`

**Цель:** вход в систему.

- Поля: email, password; кнопка «Войти».
- Ссылка «Забыли пароль?» → `/forgot-password`.
- При успехе: cookie + редирект на `?redirect=` или `/`.
- При 401: inline-ошибка «Неверный email или пароль».
- API: `POST /api/v1/panel/auth/login`.

---

### `/forgot-password`

**Цель:** запрос письма со ссылкой для сброса пароля.

- Поле: email; кнопка «Отправить».
- После отправки — success-state (сообщение всегда одинаковое, не раскрываем наличие аккаунта).
- API: `POST /api/v1/panel/auth/forgot-password`.

---

### `/reset-password/:token`

**Цель:** установка нового пароля по токену из письма.

- Поля: новый пароль, подтверждение.
- Валидация: минимум 8 символов, совпадение.
- При невалидном/просроченном токене — ошибка с предложением запросить снова.
- API: `POST /api/v1/panel/auth/reset-password`.

---

### `/signup/invite/:token`

**Цель:** принятие приглашения, установка имени и пароля.

- Показывает компанию, в которую приглашают, и роль.
- Поля: display_name, password, подтверждение.
- API: `POST /api/v1/panel/auth/signup-invite`.

---

### `/` — Dashboard

**Цель:** сводка состояния системы.

**Виджеты (cards):**
- Всего активных лицензий в доступном поддереве.
- Лицензии, истекающие в ближайшие 30 дней (с числом и кнопкой «Смотреть»).
- Лицензии без heartbeat > 48ч (count).
- Количество компаний в доступном поддереве.

**Блоки:**
- Таблица «Последние 10 выданных лицензий» с колонками: license_key, company, template, status, expires_at.
- Лента последних 10 событий audit_log.

**API:** `GET /api/v1/panel/licenses?sort=issued_at_desc&limit=10`, `GET /api/v1/panel/audit?limit=10`.

---

### `/companies` — Дерево компаний

**Цель:** навигация по иерархии компаний, CRUD.

**Слева:**
- `TreeView` — collapsible узлы с иконками статуса.
- Поиск по названию фильтрует дерево.
- Кнопка «+ дочерняя» (Sheet с формой: name, slug, contact_email, metadata).
- Drag-and-drop reparent (только Owner).

**Справа (при выборе узла):**
- Breadcrumbs от корня до выбранного.
- Stats: кол-во лицензий, дочерних компаний, пользователей.
- Кнопки: «Редактировать», «Приостановить», «Архивировать» (с confirm dialog).
- Быстрые ссылки: «Лицензии этой компании» → `/licenses?company_id=...`.

**API:** `GET /api/v1/panel/companies/tree`, `POST /api/v1/panel/companies`, `POST /api/v1/panel/companies/:id/move`.

---

### `/companies/:id` — Детали компании

**Цель:** подробная карточка компании.

**Секции:**
- Заголовок: название, slug, статус (badge), breadcrumbs.
- Info card: contact_email, created_at, metadata (collapsed JSON).
- Tabs:
  - **Дочерние компании** — таблица с колонками name, status, licenses_count, created_at.
  - **Пользователи** — таблица: display_name, email, role (badge), inherited_from; кнопка «Пригласить».
  - **Лицензии** — таблица последних 20 лицензий этой компании.
  - **Аудит** — последние 20 событий audit_log для этой компании.

**Действия:** Edit (Sheet), Suspend/Activate, Archive — с confirm dialog и полем ввода названия.

**API:** `GET /api/v1/panel/companies/:id`, `GET /api/v1/panel/licenses?company_id=:id`.

---

### `/companies/:id/users` — Управление пользователями

**Цель:** просмотр и изменение ролей.

- Таблица: email, display_name, role, inherited_from, granted_at, granted_by.
- «Inherited» строки — серые, без кнопки Remove.
- Кнопка «Пригласить» → форма: email, role (Select: owner/admin/viewer).
- Кнопка «Удалить» у собственных назначений.
- API: `POST /api/v1/panel/companies/:id/users`, `DELETE /api/v1/panel/companies/:id/users/:userId`.

---

### `/templates` — Глобальный список шаблонов

**Цель:** просмотр всех шаблонов; только Operator может создавать.

**Таблица (TanStack Table):** name, product_code, status (badge: draft/active/archived), current_version, created_at.

**Фильтры:** по status, поиск по name/product_code.

**Действия в строке:** «Просмотр», «Редактировать» (только Operator).

**Кнопка «+ Шаблон»:** только для Operator, ведёт на `/templates/new`.

**API:** `GET /api/v1/panel/templates`.

---

### `/templates/new` — Создание шаблона (только Operator)

**Цель:** мастер создания нового глобального шаблона.

**Шаги:**
1. **Основное** — name, product_code (slug, уникальный), description, default_validity_days, default_offline_days.
2. **Config Schema** — Monaco-editor с JSON Schema; live-preview формы справа (рендерится тем же resolver'ом, что при выпуске лицензии). Поля в форме — всегда пустые.
3. **Defaults** — секция `description`/`placeholder` для каждого поля схемы; задаёт подсказки UI, не предзаполняет значения.
4. **Криптография** — выбор signing key (сгенерировать новый или выбрать существующий). Download public key.
5. **Ревью** — сводка всех настроек перед сохранением. Статус = `draft`.

**API:** `POST /api/v1/panel/templates`, затем `POST /api/v1/panel/templates/:id/versions`.

---

### `/templates/:id` — Обзор шаблона

**Цель:** просмотр шаблона и его версионной истории.

**Секции:**
- Заголовок: name, product_code, status (badge), текущая версия.
- Card «Метаданные»: description, default_validity_days, default_offline_days.
- Card «Криптография»: текущий signing key, алгоритм, статус, not_before/not_after.
- Таблица версий: version, changelog, created_by, created_at, кнопка «Сравнить».

**Кнопки (только Operator):** «Редактировать», «Активировать»/«Архивировать».

**API:** `GET /api/v1/panel/templates/:id`, `GET /api/v1/panel/templates/:id/versions`.

---

### `/templates/:id/edit` — Редактор шаблона (только Operator)

**Цель:** создание новой версии шаблона.

Tabs:

1. **General** — name, description, default_validity_days, default_offline_days, status.
2. **Config Schema** — Monaco-editor (JSON Schema); live-preview формы справа — поля пустые. При изменении схемы старые значения не переносятся.
3. **Defaults** — настройка placeholder/description для каждого поля схемы (не предзаполнение!).
4. **Криптография** — текущий signing key, кнопка «Ротировать ключ» (generate new + retire старый).
5. **Версии** — diff side-by-side между версиями.

**Сохранение** → `POST /api/v1/panel/templates/:id/versions` → создаётся новая версия, `current_version_id` указывает на неё. Существующие лицензии остаются на старой версии.

**Предупреждение:** если у шаблона есть активные лицензии, при смене схемы показывается banner «N лицензий на предыдущей версии».

---

### `/templates/:id/versions/:ver` — Просмотр версии

**Цель:** инспекция конкретной версии шаблона.

- Config schema — подсвеченный JSON.
- Diff с предыдущей версией (side-by-side Monaco diff viewer).
- Кнопка «Посмотреть лицензии на этой версии» → `/licenses?template_version_id=:ver`.

---

### `/licenses` — Таблица лицензий

**Цель:** глобальный список лицензий доступного поддерева.

**Таблица:** license_key, company, template, status (badge), expires_at, last_heartbeat_at, created_at.

**Фильтры (панель сверху):**
- Компания (выбор из дерева).
- Шаблон (Select из глобального списка).
- Статус (multi-select: active / suspended / revoked / expired).
- «Истекает через N дней» (preset: 7, 30, 90 дней).
- «Без heartbeat > N часов».

**Экспорт:** CSV / JSON выбранных строк.

**Кнопка «+ Лицензия»** → `/licenses/new`.

**API:** `GET /api/v1/panel/licenses?company_id=...&status=...&template_id=...`.

---

### `/licenses/new` — Wizard выпуска лицензии

**Цель:** выпустить новую лицензию.

**Шаги:**

1. **Шаблон** — выбор из глобального списка активных шаблонов (Search + карточки с product_code, description).
2. **Компания** — выбор компании-владельца из доступного поддерева (TreeSelect).
3. **Конфигурация** — автогенерированная форма из `config_schema` выбранного шаблона:
   - Поля **всегда начинают пустыми**; `defaults.description`/`defaults.placeholder` — подсказки.
   - shadcn-компоненты по типам: `string` → Input, `boolean` → Switch, `number` → NumberInput, `array` → repeater, `enum` → Select.
   - Зависимые поля через JSON Schema `if/then`.
   - Live-валидация zod, синхронизированная со schema.
4. **Параметры** — `expires_at` (datepicker + preset: 30/90/365 дней), `offline_days` (preset/custom), `hw_fingerprint` mode (`none` / `pin_on_first_activation` / `pin_now`).
5. **Ревью** — read-only preview итогового payload (JSON).
6. **Готово** — server signs → возвращает license_key, ссылки: скачать `.sigil` файл, скачать public key.

**API:** `POST /api/v1/panel/licenses`.

---

### `/licenses/:id` — Детали лицензии

**Цель:** полная информация о лицензии.

**Заголовок:** license_key, status (badge с цветом), «Истекает через N дней» / «Истекла», last heartbeat M минут назад.

**Действия:** Edit, Revoke (диалог с причиной), Download `.sigil`, Reissue.

**Tabs:**

- **Overview** — конфиг (collapsed JSON с expand), шаблон, версия шаблона, компания, issued_by, created_at, expires_at, offline_days, hw_fingerprint mode.
- **Activations** — таблица: hw_fingerprint, host_name, os, ip, activated_at, deactivated_at; кнопка «Деактивировать» у активных.
- **Heartbeats** — line chart (по часам) + таблица последних 100: received_at, ip, client_version, payload.
- **Версии** — таблица license_versions: version, signed_at, signed_by, diff от предыдущей, кнопка «Откатить».
- **Аудит** — события audit_log для этой лицензии.

**API:** `GET /api/v1/panel/licenses/:id`, `GET /api/v1/panel/licenses/:id/activations`, `GET /api/v1/panel/licenses/:id/heartbeats`, `GET /api/v1/panel/licenses/:id/versions`.

---

### `/licenses/:id/edit` — Изменение конфига лицензии

**Цель:** изменить config лицензии → создать новую version + re-sign.

- Форма из той же `config_schema`, что при выпуске; поля **предзаполнены текущими значениями** (в отличие от шаблона — здесь данные уже реальные).
- После сохранения сервер создаёт новую `license_version`, клиенты получат обновление при следующем heartbeat.
- Banner: «Изменение конфига создаст версию N+1. Все клиенты получат обновление при следующем heartbeat».
- API: `PATCH /api/v1/panel/licenses/:id`.

---

### `/audit` — Аудит-лог

**Цель:** просмотр всех событий.

- Виртуализированная таблица (TanStack Virtual): occurred_at, actor, entity_kind (badge), action, company.
- Фильтры: actor (email), entity_kind, action, time range, company subtree.
- Клик по строке → Drawer с before/after diff (JSON) и полным контекстом.
- API: `GET /api/v1/panel/audit?entity_kind=...&actor=...&from=...&to=...`.

---

### `/settings/profile` — Профиль

- Поля: display_name (редактируемый), email (read-only), last_login_at.
- Смена пароля: current_password, new_password, confirm.
- API: `PATCH /api/v1/panel/auth/me`.

---

### `/settings/api-tokens` — API-токены (PAT)

**Цель:** управление токенами для CI/automation.

- Таблица: name, last_used_at, created_at, expires_at, scope.
- «+ Создать токен» → Sheet: name, expiry (none / 30d / 90d / 1y), scope (выбор компании + роль). Токен показывается **один раз** после создания.
- Кнопка «Отозвать» у каждого токена.
- API: `GET /api/v1/panel/settings/api-tokens`, `POST /api/v1/panel/settings/api-tokens`, `DELETE /api/v1/panel/settings/api-tokens/:id`.

---

### `/settings/webhooks` — Webhooks

**Цель:** подписка на события Sigil.

- Таблица endpoint'ов: url, events (badges), status (active/disabled), created_at.
- «+ Endpoint» → Sheet: URL, secret, events (multi-select: license.issued, license.revoked, license.expired, license.activated, license.heartbeat_missed).
- Строка endpoint'а → expand: история последних 20 доставок (status, response_code, latency, retry_count, кнопка «Replay»).
- API: `GET /api/v1/panel/settings/webhooks`, `POST /api/v1/panel/settings/webhooks`.

---

### `/operator` — Operator Dashboard (только Sigil staff)

**Цель:** глобальный обзор всей платформы.

**Виджеты:**
- Всего tenant'ов (root companies), активных / приостановленных.
- Всего лицензий по статусам (pie chart).
- Активных heartbeat'ов за последние 24ч.
- Последние 10 зарегистрированных компаний.

---

### `/operator/companies` — Все компании (только Operator)

- Таблица: name, slug, status, licenses_count, users_count, created_at.
- Действия: Suspend, Activate, View.
- Создать root-компанию → Sheet с формой + автоматическое приглашение первого Owner'а.
- API: `GET /api/v1/panel/operator/companies`, `POST /api/v1/panel/operator/companies/:id/suspend`.

---

### `/operator/templates` — Управление глобальными шаблонами (только Operator)

- Полный CRUD шаблонов (аналог `/templates` + `/templates/:id/edit`).
- Видны шаблоны в любом статусе, включая `archived`.
- Массовые действия: активировать / архивировать несколько.
- API: все `/api/v1/panel/operator/templates` endpoint'ы.

---

### `/operator/feature-flags` — Feature Flags (только Operator)

- Таблица флагов: name, description, enabled (toggle), updated_at.
- Включение/выключение без деплоя.

---

## Auth-флоу

1. `/login` → `POST /api/v1/panel/auth/login { email, password }` → HttpOnly cookie + CSRF token в response.
2. Каждый запрос через axios-instance с `X-CSRF-Token` из mem-storage.
3. 401 → редирект на `/login` с возвратом по `?redirect=`.
4. Refresh — sliding session, продлевается при активности.
5. Invite-флоу: оператор/owner отправляет invite → email с `/signup/invite/:token` → форма установки пароля.

## Уведомления

- Toast (sonner) для async-операций.
- Banner сверху, если у пользователя: истекающие лицензии > 0 (с числом).
- Опционально SignalR для real-time обновления статуса лицензии (после revoke).

## Состояния и UX-детали

- **Skeleton loaders** на всех таблицах и cards.
- **Optimistic updates** при revoke / edit.
- **Confirm dialog** на любые destructive операции с типизацией названия объекта.
- **Empty states** с понятной CTA («У вас нет ни одного шаблона — обратитесь к оператору»).
- **Темы** через CSS-variables shadcn; default — system.
- **Локализация:** i18next с RU/EN; ключи в `locales/{lang}/{namespace}.json`.

## Доступ через API token

В `/settings/api-tokens` пользователь создаёт PAT с правами в рамках своей роли и scope (одна компания + потомки). Токен показывается один раз. Используется для CI-pipelines (например, автовыпуск лицензий из CD).
