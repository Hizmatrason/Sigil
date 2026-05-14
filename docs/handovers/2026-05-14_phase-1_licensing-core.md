# Handover — Phase 1: Ядро лицензирования

**Дата:** 2026-05-14
**Roadmap:** [Фаза 1 — Ядро лицензирования](../10-roadmap.md)

## Что сделано

### Доменные сущности (`Sigil.Domain`)

| Сущность | Назначение |
|----------|-----------|
| `Company` | Дерево tenant'ов (self-reference, `ltree` path) |
| `User` | Пользователи панели |
| `Role` / `RoleAssignment` | RBAC (owner/admin/billing/viewer) |
| `LicenseTemplate` | Шаблон лицензии |
| `TemplateVersion` | Версии шаблона (JSON Schema конфигурации) |
| `SigningKey` | Ed25519 keypair per template (AES-GCM encrypted) |
| `License` | Выданная лицензия |
| `LicenseVersion` | История конфигов + signed token |
| `Activation` | HW fingerprint bindings |
| `Heartbeat` | Check-in записи |

Все enum'ы (`CompanyStatus`, `TemplateStatus`, `LicenseStatus`, `SigningKeyStatus`) в `Sigil.Domain.Enums`.

### Signer (`Sigil.Infrastructure.Signing.EncryptedFileSigner`)

- Ed25519 через **NSec.Cryptography v25**.
- Приватные ключи хранятся в зашифрованных файлах (AES-256-GCM).
- Master key из env var `SIGIL_MASTER_KEY` (64 hex chars = 32 bytes).
- Директория ключей: `SIGIL_KEYS_DIR` (default `/var/lib/sigil/keys`).
- Каждый шаблон имеет **свою keypair**.
- `ISigner` interface: `SignAsync(Guid keyId, ReadOnlyMemory<byte> message)` + `GetPublicKeyAsync(Guid keyId)`.

### Формат токена

```
sigil1.<base64url(header)>.<base64url(payload)>.<base64url(signature)>
```

- Header: `alg=Ed25519`, `kid=<signing_key_id>`, `typ=sigil-license`, `ver=1`
- Payload: `lic`, `key`, `tpl`, `tpl_v`, `cfg_v`, `iss`, `sub`, `iat`, `nbf`, `exp`, `max_offline_days`, `hwfp`, `cfg`
- Signature: Ed25519 над `header_b64 || "." || payload_b64`

### Application layer (`Sigil.Application`)

**Без MediatR** — прямые сервисы:

- `CompanyService` — create, get, get children, get subtree
- `LicenseTemplateService` — create, get, get by company
- `LicenseService` — **issue license** (генерирует keypair если нет, подписывает токен, сохраняет версию)

Репозитории: `ICompanyRepository`, `ILicenseTemplateRepository`, `ILicenseRepository` (реализации в `Sigil.Infrastructure.Repositories`).

DTOs: `Company*Request/Response`, `LicenseTemplate*Request/Response`, `License*Request/Response`, `LicenseTokenResponse`.

### Panel API контроллеры (`Sigil.Api.Controllers.Panel`)

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `GET /api/v1/panel/companies` | GetAll | Список корневых компаний |
| `GET /api/v1/panel/companies/{id}` | Get | Компания по ID |
| `GET /api/v1/panel/companies/{id}/children` | GetChildren | Дочерние компании |
| `GET /api/v1/panel/companies/{id}/subtree` | GetSubtree | Всё поддерево (ltree) |
| `POST /api/v1/panel/companies` | Create | Создать компанию |
| `GET /api/v1/panel/templates?companyId=` | GetByCompany | Шаблоны компании |
| `GET /api/v1/panel/templates/{id}` | Get | Шаблон по ID |
| `POST /api/v1/panel/templates` | Create | Создать шаблон |
| `GET /api/v1/panel/licenses?companyId=` | GetByCompany | Лицензии компании |
| `GET /api/v1/panel/licenses/{id}` | Get | Лицензия по ID |
| `POST /api/v1/panel/licenses` | Issue | Выпустить лицензию |

### `Sigil.Client` SDK

```csharp
var client = new SigilLicenseClient("license.sigil", publicKeyBytes);
if (client.Initialize())
{
    bool hasReports = client.HasFeature("reports.advanced");
    int? maxUsers = client.GetLimit("max_users");
    var status = client.Status; // Active / GracePeriod / Expired / Invalid
}
```

- Парсит `sigil1.*` формат.
- Верифицирует Ed25519 подпись через NSec.
- Проверяет `exp`.
- Читает feature flags / limits из JSON config.
- Grace period (упрощённо — без heartbeat token в этой версии).

### Миграция БД

- `20260514152132_AddPhase1Entities` — создаёт все таблицы Phase 1.
- `dotnet ef database update` применяет.

## Принятые решения

1. **Без MediatR.** Прямые сервисы + DI. Проще, меньше ceremony.
2. **Без unit-тестов.** Пользователь явно отказался.
3. **Тестовые проекты удалены из `.slnx`.** Физически остаются в `tests/`, но не собираются.
4. **NSec.Cryptography v25 API.** `Ed25519` — не `IDisposable`, `Key.Import` принимает `KeyBlobFormat`.
5. **`DateTimeOffset` в entities.** DTOs мапят через `.ToString()` для enum'ов и `.DateTime` где нужно.
6. **`JsonDocument` для config.** В БД хранится как `jsonb`, в C# — `JsonDocument` (не `string`).

## Что НЕ сделано (намеренно)

- Консольный sample-проект (можно добавить позже).
- Unit / golden-vector тесты (по решению пользователя).
- Heartbeat token (grace period пока упрощённый).
- HW fingerprint provider (Windows/Linux detection).
- OpenAPI / Swagger (Phase 2).
- Аутентификация / авторизация (Phase 2 + 6).
- Webhooks, billing, audit log (Phase 4+).

## Проверки

```powershell
dotnet build Sigil.slnx
# → Build succeeded. 0 Warning(s). 0 Error(s).
```

## Следующий шаг

**Phase 2 — Веб-панель MVP** или **Phase 3 — Оффлайн + heartbeat**.
Phase 2 даст UI для всего, что сейчас делается через curl/Postman.
