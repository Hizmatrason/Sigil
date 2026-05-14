# 03 — Протокол лицензий

## Терминология: «зашифровать приватным, расшифровать публичным» — это **цифровая подпись**

В исходной постановке прозвучало: «лицензия зашифрована и расшифровывается публичным ключом, но шифруется только серверным приватным». С криптографической точки зрения это **digital signature**, а не шифрование:

- В RSA исторически операция signing технически выглядит как «шифрование приватником», что породило миф. Но семантически это **подпись** — гарантия аутентичности и целостности, а не конфиденциальности.
- В современных схемах (Ed25519, ECDSA) такого «зеркала» вообще нет — есть `Sign(privkey, msg)` и `Verify(pubkey, msg, sig)`.
- Содержимое лицензии (config, лимиты, фичи) живёт в **plaintext**, который **подписан**. Любой, у кого есть файл лицензии, может его прочитать — и это нормально: владелец сервера и так знает, на каких фичах работает его инсталляция.
- Если действительно нужна конфиденциальность payload (скрыть фичи даже от клиента) — добавим гибридное шифрование: AES-GCM ключом, который зашит в клиентский SDK. Но для v1 — **не нужно**.

**Итог:** используем **Ed25519 signature** поверх plaintext-payload. Это даёт ровно тот эффект, который описал заказчик: подделать лицензию без приватного ключа невозможно.

## Алгоритм

- **Ed25519** (RFC 8032).
- 32-байтовая публичная часть, 64-байтовая подпись — компактно, отлично для встраивания.
- Скорость verify — десятки тысяч ops/sec на одно ядро.
- Имплементация — `NSec.Cryptography` (managed, легко) или `BouncyCastle` (если нужно совместимость).

Каждый шаблон лицензии имеет **собственную keypair** (`signing_keys.template_id`). Компрометация ключа продукта A не валит продукт B.

## Формат токена лицензии (`*.sigil` файл)

Используем **компактный JWS-подобный формат** (но не JWT — JWT неудачен для бинарных полей и длинных payload'ов). Структура:

```
sigil1.<base64url(header)>.<base64url(payload)>.<base64url(signature)>
```

### Header

```json
{
  "alg": "Ed25519",
  "kid": "8b6e3f6d-...",          // signing_keys.id
  "typ": "sigil-license",
  "ver": 1
}
```

### Payload

```json
{
  "lic": "0193f7ce-...",          // license_id
  "key": "SGIL-AB12-CD34-EF56",   // human-readable license_key
  "tpl": "06ad3c0e-...",          // template_id
  "tpl_v": 4,                     // template_version
  "cfg_v": 7,                     // version конфига этой лицензии (= license_versions.version)
  "iss": "https://api.sigil.hizmatrason.tj",
  "sub": "0193f7d0-...",          // company_id (владельца)
  "iat": 1747200000,
  "nbf": 1747200000,
  "exp": 1778736000,              // hard expiry (license.expires_at)
  "max_offline_days": 30,
  "hwfp": "sha256:7c8a...",       // опционально; null если без привязки
  "cfg": {                        // произвольный JSON по схеме template_versions.config_schema
    "features": ["reports.basic", "reports.advanced"],
    "limits": {
      "max_users": 50,
      "requests_per_day": 100000
    },
    "tier": "enterprise"
  },
  "rev": null                     // revocation marker; в нормальном токене всегда null
}
```

### Signature

Подпись Ed25519 над байтами `header_b64 || '.' || payload_b64` (UTF-8).

### Размер

- Header: ~80 байт
- Payload: 400–800 байт (зависит от cfg)
- Signature: 64 байта → 86 в base64url
- **Итого: ~1–1.5 КБ** — спокойно помещается в файл, env-var или embed-ресурс.

## Heartbeat-токен (для оффлайн-учёта)

Чтобы клиент не мог «откатить» время отсутствия сети простым изменением системных часов или удалением state-файла, сервер при каждом успешном heartbeat выдаёт **подписанный heartbeat-маркер**:

```
sigil1hb.<payload_b64>.<sig_b64>
```

Payload:
```json
{
  "lic": "0193f7ce-...",
  "checked_at": 1747200000,
  "next_checkin_after": 1747286400,    // 24ч
  "grace_until": 1749792000,           // checked_at + 30d
  "config_version": 7
}
```

SDK хранит этот файл рядом с лицензией (`license.heartbeat`). Перед запуском продукта:

1. Verify подпись heartbeat'а тем же публичным ключом.
2. `now < grace_until` → продукт работает.
3. `now >= grace_until` → degraded mode, отказ работы.

Удаление файла = автоматический выход за grace (потому что прошлый файл не предъявлен, а сразу получить новый можно только через сеть).

## Hardware fingerprint

Опциональное поле `hwfp`. Алгоритм формирования fingerprint'а SDK:

1. Собираем стабильные источники:
   - Machine GUID (Windows: `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`; Linux: `/etc/machine-id`).
   - Серийный номер материнки (через WMI / DMI), опционально — для дата-центра отключаем.
   - Первый non-virtual MAC.
   - CPU vendor + family + model.
2. JSON-нормализуем → SHA-256 → hex.
3. Кладём в формате `sha256:<hex>`.

**Активация:** первый запуск SDK без сохранённого fingerprint'а отправляет `POST /activate { hwfp }`. Сервер:
- Если у лицензии `hwfp` ещё пустой → записывает и переподписывает токен.
- Если уже задан и не совпадает → `409 Conflict`. Чтобы привязать к новой машине, нужен явный `Re-activate` в панели (с инкрементом счётчика и аудитом).

В шаблоне можно отключить fingerprint (`hwfp_required: false`) — тогда лицензия годится на любых хостах.

## Версионирование и refresh

- Поле `cfg_v` в payload = `license.current_version`.
- При каждом heartbeat клиент шлёт свой `cfg_v`. Если в БД `current_version > client.cfg_v` → сервер возвращает свежий signed token + новый heartbeat-маркер.
- SDK атомарно заменяет файлы (`File.Replace` или rename pattern), чтобы исключить «полуобновлённое» состояние.

## Отзыв (revocation)

Глобального CRL не делаем — слишком тяжело для оффлайн-сценария. Используем два механизма:

1. **Поллинг через heartbeat:** при revoke сервер при следующем heartbeat возвращает `403` + **revocation token**:
   ```json
   { "lic": "...", "revoked_at": 1747200000, "reason": "non-payment" }
   ```
   плюс подпись. SDK сохраняет его локально и блокирует работу. После сохранения «откатить» revoke нельзя — даже если файл удалят, сервер при следующем heartbeat снова его выдаст.

2. **Внеплановый push (опционально):** если у заказчика есть стабильная сеть — можно прокинуть WebSocket/SSE-канал для мгновенного revoke. На v1 — поллинг достаточно.

Анти-rollback на time-tampering: хранить `max(seen_server_time)` в каждом локальном файле и игнорировать локальные часы, если они отстают от последнего видения серверного времени.

## Контракт клиентского SDK (черновик API)

```csharp
public sealed class SigilLicenseClient : IAsyncDisposable
{
    public SigilLicenseClient(SigilOptions options);

    public Task InitializeAsync(CancellationToken ct = default);

    // Состояние
    public LicenseStatus Status { get; }           // Active / GracePeriod / Expired / Revoked / Invalid
    public DateTimeOffset? ExpiresAt { get; }
    public DateTimeOffset? GraceUntil { get; }
    public IReadOnlyDictionary<string, JsonElement> Config { get; }

    // Удобные хелперы
    public bool Has(string feature);
    public int? GetLimit(string key);
    public T? GetConfig<T>(string path);

    // Принудительные операции
    public Task<bool> RefreshAsync(CancellationToken ct = default);
    public Task<ActivationResult> ActivateAsync(CancellationToken ct = default);

    // События
    public event EventHandler<LicenseStatusChangedEventArgs> StatusChanged;
}

public sealed class SigilOptions
{
    public required string LicenseFilePath { get; init; }
    public required byte[] PublicKey { get; init; }       // 32 байта, embedded resource
    public string ServerUrl { get; init; } = "https://api.sigil.hizmatrason.tj";
    public IHardwareFingerprintProvider? HardwareFingerprintProvider { get; init; }
    public TimeSpan HeartbeatInterval { get; init; } = TimeSpan.FromHours(24);
    public TimeSpan HeartbeatJitter { get; init; }    = TimeSpan.FromHours(2);
}
```

Поведение по умолчанию:

- Background task ходит на heartbeat в `HeartbeatInterval ± HeartbeatJitter`.
- При сетевых ошибках — экспоненциальный backoff, без падений.
- При получении нового токена — атомарная замена + событие.
- При degraded mode — НЕ ломает продукт, но `Has(...)` начинает возвращать `false` для всех платных фич (поведение настраивается).

## Криптографическая сводка

| Зачем | Алгоритм | Где |
|-------|----------|-----|
| Подпись лицензии | Ed25519 | Серверный Signer ↔ клиентский SDK |
| Подпись heartbeat-маркера | Ed25519 | Тот же ключ шаблона |
| Hardware fingerprint | SHA-256 над нормализованным JSON | SDK |
| Хеш паролей пользователей панели | Argon2id | Backend |
| TLS | TLS 1.3 (Cloudflare edge) | Все API |
| Хранение приватного ключа | Зашифрованный файл (AES-256-GCM), master key из env | Серверный signer |
| (Опц.) шифрование payload | AES-GCM с ключом в SDK | Не нужно для v1 |
