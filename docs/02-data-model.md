# 02 — Модель данных

Все таблицы — PostgreSQL 16. Идентификаторы — `uuid` (Version 7 для упорядоченности), даты — `timestamptz`, JSON-конфиги — `jsonb`. EF Core с `UseSnakeCaseNamingConvention()`.

## Обзор сущностей

```
                            ┌───────────────┐
                            │  operators    │ (сотрудники Sigil)
                            └───────────────┘

  companies ◄──parent_id (self ref, tree)
       │
       │ 1..*                 1..*
       ├──── users           ────► role_assignments ────► roles
       │
       │ 1..*
       ├──── license_templates ──── 1..* ──► template_versions
       │                                            │
       │                                            │ 1
       │                                            ▼
       │                                       signing_keys (Ed25519 keypair per template)
       │
       │ 1..*
       └──── licenses ──── 1..*  ──► license_versions (история изменений config)
                  │
                  ├──── 1..*  ──► activations (HW fingerprint bindings)
                  └──── 1..*  ──► heartbeats

  plans ──── 1..* ──► subscriptions ──── 1..* ──► invoices ──── 1..* ──► invoice_lines
                              │
                              └── attached to companies

  audit_log (полиморфно ссылается на любую сущность)
```

## Таблицы (DDL-эскизы)

### `companies` — дерево tenant'ов

```sql
CREATE TABLE companies (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  parent_id       uuid REFERENCES companies(id) ON DELETE RESTRICT,
  name            text NOT NULL,
  slug            text NOT NULL,                    -- для URL панели
  path            ltree NOT NULL,                   -- materialized path для быстрых запросов потомков
  depth           int  NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active',   -- active / suspended / archived
  contact_email   text,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, slug)
);
CREATE INDEX companies_parent_idx ON companies(parent_id);
CREATE INDEX companies_path_gist  ON companies USING gist(path);
```

**Зачем `ltree`/`path`?** Чтобы вопрос «дай всех потомков компании X» решался одним индексным сканом `WHERE path <@ 'x.path'`, не рекурсивным CTE на каждый запрос.

**Why no soft-tenant_id column?** Внутри одного дерева компания == владелец. Если нужно изолировать совершенно разные деревья (например, white-label инсталляции) — добавим `root_company_id` denormalized.

### `users` и роли

```sql
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  email          citext NOT NULL UNIQUE,
  password_hash  text,                              -- argon2id; null если SSO-only
  display_name   text,
  is_operator    boolean NOT NULL DEFAULT false,    -- сотрудник Sigil
  is_active      boolean NOT NULL DEFAULT true,
  last_login_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  id   serial PRIMARY KEY,
  code text UNIQUE NOT NULL                          -- owner / admin / billing / viewer
);

CREATE TABLE role_assignments (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role_id    int  NOT NULL REFERENCES roles(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES users(id),
  PRIMARY KEY (user_id, company_id, role_id)
);
```

Назначение роли на узел дерева автоматически даёт доступ ко всем потомкам (логика в Application-слое через path-фильтр).

### `license_templates` и версии

```sql
CREATE TABLE license_templates (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  company_id     uuid NOT NULL REFERENCES companies(id),
  name           text NOT NULL,
  product_code   text NOT NULL,                     -- стабильный ID продукта
  description    text,
  default_offline_days  int NOT NULL DEFAULT 30,
  default_validity_days int NOT NULL DEFAULT 365,
  status         text NOT NULL DEFAULT 'draft',     -- draft / active / archived
  current_version_id uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, product_code)
);

CREATE TABLE template_versions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  template_id   uuid NOT NULL REFERENCES license_templates(id) ON DELETE CASCADE,
  version       int  NOT NULL,
  config_schema jsonb NOT NULL,                     -- JSON Schema, по которой валидируется config лицензии
  defaults      jsonb NOT NULL DEFAULT '{}',        -- значения по умолчанию
  signing_key_id uuid NOT NULL REFERENCES signing_keys(id),
  changelog     text,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
```

Каждое изменение шаблона = новая версия. Существующие лицензии остаются на своей версии до явного «миграция config».

### `signing_keys` — пары ключей подписи

```sql
CREATE TABLE signing_keys (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  template_id     uuid REFERENCES license_templates(id) ON DELETE RESTRICT,
  public_key      bytea NOT NULL,                   -- 32 байта Ed25519
  private_key_ref text NOT NULL,                    -- KMS key arn / vault path; никогда не лежит в БД сырым
  algorithm       text NOT NULL DEFAULT 'ed25519',
  status          text NOT NULL DEFAULT 'active',   -- active / rotating / retired / compromised
  not_before      timestamptz NOT NULL DEFAULT now(),
  not_after       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signing_keys_template_idx ON signing_keys(template_id);
```

### `licenses` — выданные лицензии

```sql
CREATE TABLE licenses (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  company_id        uuid NOT NULL REFERENCES companies(id),
  template_id       uuid NOT NULL REFERENCES license_templates(id),
  template_version_id uuid NOT NULL REFERENCES template_versions(id),
  license_key       text NOT NULL UNIQUE,           -- человекочитаемый id, напр. "SGIL-AB12-..."
  status            text NOT NULL DEFAULT 'active', -- active / suspended / revoked / expired
  config            jsonb NOT NULL DEFAULT '{}',     -- значения по schema
  hw_fingerprint    text,                            -- nullable; задаётся при активации
  offline_days      int  NOT NULL DEFAULT 30,
  issued_at         timestamptz NOT NULL DEFAULT now(),
  activated_at      timestamptz,
  expires_at        timestamptz NOT NULL,
  last_heartbeat_at timestamptz,
  revoked_at        timestamptz,
  revocation_reason text,
  current_version   int NOT NULL DEFAULT 1,
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX licenses_company_idx     ON licenses(company_id);
CREATE INDEX licenses_template_idx    ON licenses(template_id);
CREATE INDEX licenses_status_idx      ON licenses(status);
CREATE INDEX licenses_expires_at_idx  ON licenses(expires_at);
```

### `license_versions` — история конфигов

```sql
CREATE TABLE license_versions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  license_id  uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  version     int  NOT NULL,
  config      jsonb NOT NULL,
  signed_token text NOT NULL,                       -- сам подписанный токен (см. 03)
  signed_at   timestamptz NOT NULL DEFAULT now(),
  signed_by   uuid REFERENCES users(id),
  UNIQUE (license_id, version)
);
```

Каждое изменение config → новая запись. SDK при heartbeat сверяет `current_version` и подтягивает свежий токен.

### `activations` и `heartbeats`

```sql
CREATE TABLE activations (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  license_id     uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  hw_fingerprint text NOT NULL,
  host_name      text,
  os             text,
  ip             inet,
  activated_at   timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz,
  UNIQUE (license_id, hw_fingerprint)
);

CREATE TABLE heartbeats (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  license_id     uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  activation_id  uuid REFERENCES activations(id) ON DELETE SET NULL,
  ip             inet,
  client_version text,
  payload        jsonb,                              -- метрики, опционально
  received_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX heartbeats_license_time_idx ON heartbeats(license_id, received_at DESC);
```

Heartbeat'ы быстро накапливаются → partitioning by month + retention 90 дней (Hangfire job).

### Биллинг (см. [04-billing.md](04-billing.md))

```sql
CREATE TABLE plans (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  name        text NOT NULL,
  code        text UNIQUE NOT NULL,
  price_cents int  NOT NULL,
  currency    text NOT NULL DEFAULT 'USD',
  interval    text NOT NULL,                        -- month / year
  features    jsonb NOT NULL DEFAULT '{}',          -- лимиты тарифа (max_licenses, max_templates...)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  company_id    uuid NOT NULL REFERENCES companies(id),
  plan_id       uuid NOT NULL REFERENCES plans(id),
  status        text NOT NULL,                      -- trialing / active / past_due / canceled
  trial_end     timestamptz,
  current_period_start timestamptz NOT NULL,
  current_period_end   timestamptz NOT NULL,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  external_ref  text,                               -- Stripe subscription id (опц.)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  company_id  uuid NOT NULL REFERENCES companies(id),
  subscription_id uuid REFERENCES subscriptions(id),
  number      text UNIQUE NOT NULL,
  status      text NOT NULL,                        -- draft / open / paid / void
  total_cents int  NOT NULL,
  currency    text NOT NULL,
  issued_at   timestamptz NOT NULL DEFAULT now(),
  due_at      timestamptz,
  paid_at     timestamptz
);

CREATE TABLE invoice_lines (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v7(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(10,2) NOT NULL DEFAULT 1,
  unit_cents  int NOT NULL,
  amount_cents int NOT NULL
);
```

### `audit_log`

```sql
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid REFERENCES users(id),
  actor_kind  text NOT NULL,                        -- user / system / client_sdk
  company_id  uuid REFERENCES companies(id),
  entity_kind text NOT NULL,                        -- license / template / company / subscription...
  entity_id   uuid,
  action      text NOT NULL,                        -- created / updated / revoked / signed / dns_provisioned ...
  diff        jsonb,                                -- before/after; для крупных — храним только хеш и ссылку в S3
  request_id  text,
  ip          inet
);
CREATE INDEX audit_company_time_idx ON audit_log(company_id, occurred_at DESC);
CREATE INDEX audit_entity_idx       ON audit_log(entity_kind, entity_id);
```

## Запросы-«красные нити»

1. **«Все лицензии в дереве компании X»:**
   ```sql
   SELECT l.* FROM licenses l
   JOIN companies c ON c.id = l.company_id
   WHERE c.path <@ (SELECT path FROM companies WHERE id = $1);
   ```

2. **«Лицензии, протухающие в ближайшие 30 дней»:** индекс по `expires_at` отрабатывает напрямую.

3. **«История изменений конфига лицензии»:** `license_versions WHERE license_id = $1 ORDER BY version DESC`.

4. **«Активные heartbeat'ы за последний час»:** партицирование `heartbeats` по месяцам + индекс `(license_id, received_at DESC)`.

## Миграции

- Используем **EF Core Migrations** + ручные patch'и для `ltree` (расширение требует raw SQL: `CREATE EXTENSION IF NOT EXISTS ltree;`).
- Конвенция: одна миграция = одна логически связная фича.
- В CI: миграции применяются в pre-deploy hook, app поднимается только после `migrate` exit 0.
