# 08 — Безопасность

## Модель угроз

| Кто | Что хочет | Как защищаемся |
|-----|-----------|----------------|
| Заказчик с лицензией | Изменить config / снять revocation / удлинить срок | Ed25519 подпись, локально невозможно подделать без приватника |
| Заказчик с лицензией | Не платить и работать оффлайн вечно | 30-дневный grace + signed heartbeat-маркер с server_time, нельзя «откатить» удалением state |
| Заказчик с лицензией | Запустить лицензию на N серверов | HW fingerprint binding + revocation при обнаружении дубликата |
| Внешний атакующий | Брутить license_key через client API | Rate-limit per IP/license, HMAC-подпись запросов |
| Внешний атакующий | Утечка пользовательских данных через панель | Аутентификация, RBAC, изоляция по company subtree, аудит |
| Внутренний нарушитель (сотрудник Sigil) | Слить приватники / выпустить пиратскую лицензию | Encrypted-file signer + аудит signing-операций |
| Cloudflare-аккаунт компромисс | Перехват трафика через DNS | 2FA + hardware key на Cloudflare аккаунте; критичные операции вручную, не через API |
| Утечка backups БД | Чтение конфигов лицензий, hash'ей паролей | Шифрование бэкапов перед загрузкой в MinIO (age/gpg), Argon2id для паролей, минимизация чувствительных полей |

## Управление ключами

Главный вопрос — где живут **приватные Ed25519 ключи** шаблонов.

### `EncryptedFileSigner` — единственная реализация

- На сервере хранится зашифрованный файл `/var/lib/sigil/keys/<key_id>.enc`.
- Master key — в env-var `SIGIL_MASTER_KEY` (32-байтовое hex), загружается из docker secret или systemd `EnvironmentFile`.
- Шифрование — AES-256-GCM с nonce'ом из 12 случайных байт, прибавленным к ciphertext.
- Расшифровка только в момент подписания, ключ держится в `Span<byte>` и затирается после использования.
- Файл с ключами включён в бэкапы (уже зашифрованный → можно архивировать в MinIO).

> Cloud KMS, Vault, HSM — не используем. Всё хранится локально.

### Контракт `ISigner`

```csharp
public interface ISigner
{
    Task<byte[]> SignAsync(Guid signingKeyId, ReadOnlyMemory<byte> message, CancellationToken ct);
    Task<byte[]> GetPublicKeyAsync(Guid signingKeyId, CancellationToken ct);
}
```

Единственная реализация: `EncryptedFileSigner`.

### Ротация ключей

1. Оператор/owner создаёт **новый signing_key** для шаблона со статусом `rotating`.
2. Все новые версии шаблона/лицензии подписываются новым ключом.
3. Старые лицензии продолжают валидироваться старым ключом (статус `active`).
4. Через настраиваемый retention (например, 1 год) старый ключ переводится в `retired` — лицензии под ним перестают приниматься на heartbeat, клиенты должны переподписаться (reissue).
5. При компрометации — `compromised`, немедленно вызываются `LicenseRevokedByKeyCompromise` для всех зависимых лицензий.

Публичный ключ в SDK хранится **массивом** (поддерживаем несколько ключей одновременно, верификация проходит, если хоть один подходит) — это позволяет ротировать без остановки клиентов.

## Аутентификация

### Панель
- Пароли — **Argon2id** (`memory_cost=64MB, time_cost=3, parallelism=1`).
- Login — rate-limit 5 попыток / 15 минут на email + IP.
- Сессии — HttpOnly + Secure + SameSite=Lax cookie с opaque id (64 байта random) и server-side хранилищем сессии в PostgreSQL.
- CSRF — double-submit cookie token.
- 2FA (TOTP) — обязательно для operator-аккаунтов, опционально для tenant'ов в v1, обязательно для Owner-роли в v1.5.

### Client SDK
- Запросы подписываются HMAC-SHA256 с `license_key` как ключом (см. [06-api.md](06-api.md)).
- Лицензионный токен сам по себе — публичный (читается клиентом), но **не используется** для аутентификации API — иначе утечка одной лицензии = неотзывный токен.

### API Tokens (PAT)
- 32-байтовые random, формат `sgil_pat_<base32>`.
- При создании показываются один раз; в БД хранится Argon2id-хеш + last4 для отображения.
- Scope: company subtree + список разрешений (`templates:write`, `licenses:read`, ...).

## Аудит

- Каждое мутирующее действие пишет `audit_log` с `actor_id`, `request_id`, IP, before/after diff (PII-фильтрованный).
- Read-only действия (просмотр лицензий) **не** пишутся — иначе шум; кроме просмотра приватных данных биллинга — там пишем.
- Retention: 18 месяцев в БД, далее — экспорт в S3 (compressed JSONL).

## Защита API

- TLS 1.3 на Cloudflare edge + от Cloudflare до Kestrel.
- HSTS, CSP, X-Content-Type-Options, Referrer-Policy.
- Cloudflare WAF + rate-limit:
  - `/api/v1/panel/auth/login` — 10/min/IP.
  - `/api/v1/client/*` — 60/min/license.
  - Остальные — 600/min/session.
- Body size limit — 1 MB (config'и лицензий редко больше).
- IP allow-list для operator-аккаунтов (опц.).

## Хранение секретов в репозитории

- `.env`, `appsettings.Production.json` — никогда не коммитятся.
- Локально — `appsettings.Development.json` с заглушками.
- В CI — секреты из Gitea Actions / self-hosted runner'а (зашифрованы конфигом runner'а) или docker secret. Cloud-secrets не используем.
- `git-secrets` или `gitleaks` в pre-commit.

## Защита оффлайн-сценария от time-tampering

Подробно в [03-licensing-protocol.md](03-licensing-protocol.md), кратко:

- SDK хранит `last_server_time` = максимальный `server_time`, виденный в heartbeat-маркере.
- При проверке `now = max(local_clock, last_server_time)`.
- Это блокирует трюк «отмотать локальное время назад».

## Зависимости и поставка

- `dotnet list package --vulnerable` в CI.
- Renovate / Dependabot для обновлений.
- Подписанные NuGet-пакеты Sigil.Client (`<PackageSign>true`).
- SBOM в каждом релизе (CycloneDX через `dotnet CycloneDX`).
