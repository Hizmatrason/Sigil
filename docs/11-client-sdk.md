# 11 — Sigil.Client SDK — Руководство по интеграции

> **Аудитория:** разработчик продукта, который лицензируется через Sigil.
> Документ описывает `Sigil.Client` — .NET SDK, который встраивается в клиентское приложение.

---

## Обзор

`Sigil.Client` решает три задачи:

1. **Верификация** — при старте приложения читает `.sigil`-файл, проверяет Ed25519-подпись и срок действия без обращения к серверу.
2. **Активация + heartbeat** — при наличии сети активирует лицензию на машине и периодически (раз в час) сообщает серверу, что приложение работает.
3. **Offline grace** — если сервер недоступен, SDK работает на основе закэшированного heartbeat-маркера (`.hb`-файл) в течение `maxOfflineDays` дней.

---

## 1. Получение лицензии и публичного ключа

Перед деплоем нужно вшить в приложение публичный ключ (32 байта Ed25519, hex).

**Панель → Licenses → нужная лицензия → кнопка «Public key»** — скачает `.pub` файл с hex-строкой.

Или через API:

```
GET /api/v1/client/public-key/{licenseKey}
→ { "publicKey": "b2bcc8001e38d6c7b427eabcb8224dfc1268fefedfa466d5cc2c3de2f942b957" }
```

Конвертация в `byte[]`:

```csharp
byte[] publicKey = Convert.FromHexString("b2bcc8001e38d6c7b427...");
```

---

## 2. Распространение файла лицензии

Лицензия скачивается как `.sigil`-файл через панель (кнопка **«.sigil»**) или API:

```
GET /api/v1/panel/licenses/{id}/download
→ binary download: SGIL-AB12-CD34-EF56.sigil
```

Файл передаётся клиенту вручную или через инсталлятор.
SDK читает его с диска; рядом автоматически создаётся `.hb`-файл:

```
C:\ProgramData\YourApp\license.sigil      ← предоставляет вендор
C:\ProgramData\YourApp\license.sigil.hb   ← создаётся SDK (не удалять при апдейтах!)
```

---

## 3. Конфигурация

### appsettings.json

```json
{
  "Sigil": {
    "LicenseFile": "C:\\ProgramData\\MyApp\\license.sigil",
    "PublicKey":   "b2bcc8001e38d6c7b427eabcb8224dfc1268fefedfa466d5cc2c3de2f942b957"
  }
}
```

### `SigilClientOptions`

| Поле | Обязательное | Описание |
|------|:---:|---------|
| `LicenseFilePath` | ✓ | Путь к `.sigil`-файлу |
| `PublicKey` | ✓ | Ed25519 публичный ключ (32 байта) |
| `HwFingerprint` | — | Переопределить отпечаток (null = авто) |

> Адрес сервера (`https://sigil.hizmatrason.tj`) вшит в SDK и не настраивается.

---

## 4. Минимальная интеграция

```csharp
await using var sigil = new SigilLicenseClient(new SigilClientOptions
{
    LicenseFilePath = @"C:\ProgramData\MyApp\license.sigil",
    PublicKey       = Convert.FromHexString("b2bcc8001e38d6c7b427..."),
});

bool ok = await sigil.InitializeAsync();

if (!ok || sigil.Status != LicenseStatus.Active)
{
    Console.Error.WriteLine("Лицензия недействительна. Приложение закрыто.");
    return 1;
}

// Приложение работает
```

`InitializeAsync` за один вызов:

1. Читает `.sigil`-файл с диска
2. Проверяет Ed25519-подпись (без сети)
3. Проверяет `exp` (срок действия)
4. Загружает кэшированный `.hb`-маркер, если он есть
5. Вызывает `POST /api/v1/client/activate` (если сервер доступен)
6. Запускает фоновый heartbeat-таймер (~раз в час с ±30 сек jitter)

Возвращает `false` если файл не найден, подпись не прошла или лицензия истекла.

---

## 5. Статусы и жизненный цикл

```
Старт приложения
    │
    ├─ InitializeAsync() → false → выход
    │
    └─ true
          │
          ├─ Status == Active      ─────────────────────── ОК, работаем
          │       │
          │       └─ heartbeat не приходит N дней
          │              │
          │              └─ Status == GracePeriod ─────── предупреждение, работаем
          │                      │
          │                      └─ +24 часа
          │                             │
          │                             └─ Status == Expired ── блокируем
          │
          └─ Status == Invalid/Expired → выход сразу
```

| Статус | Условие | Рекомендуемое действие |
|--------|---------|----------------------|
| `Active` | Маркер свежий (`marker.exp > now`) | Работаем |
| `GracePeriod` | Маркер устарел, но < +24 ч | Показываем предупреждение |
| `Expired` | Маркер устарел > +24 ч или `license.exp` прошёл | Блокируем запуск |
| `Invalid` | Файл отсутствует, подпись не прошла | Блокируем запуск |
| `Revoked` | Зарезервировано | Блокируем запуск |

```csharp
switch (sigil.Status)
{
    case LicenseStatus.Active:
        break; // OK

    case LicenseStatus.GracePeriod:
        ShowBanner("Нет связи с сервером лицензирования. Работа продолжена.");
        break;

    case LicenseStatus.Expired:
    case LicenseStatus.Invalid:
    case LicenseStatus.Revoked:
        ShowError("Лицензия недействительна.");
        Environment.Exit(1);
        break;
}
```

---

## 6. Feature-флаги

Флаги задаются в конфиге шаблона как массив строк в поле `features`.

Пример JSON Schema шаблона:

```json
{
  "type": "object",
  "properties": {
    "features": {
      "type": "array",
      "default": ["core", "export"]
    }
  }
}
```

Проверка в коде:

```csharp
if (sigil.HasFeature("export"))
    menu.AddItem("Экспорт в Excel");

if (!sigil.HasFeature("analytics"))
    analyticsModule.Disable();
```

Если поле `features` отсутствует в конфиге — `HasFeature` всегда возвращает `false`.

---

## 7. Числовые лимиты и произвольный конфиг

`GetConfig<T>(path)` читает любой `struct` по dot-path из JSON конфига лицензии.

```json
{
  "maxSeats": 25,
  "cache": { "ttlSecs": 300 },
  "debugMode": false
}
```

```csharp
int? seats = sigil.GetConfig<int>("maxSeats");           // → 25
int? ttl   = sigil.GetConfig<int>("cache.ttlSecs");      // → 300
bool? dbg  = sigil.GetConfig<bool>("debugMode");         // → false

if (seats.HasValue && activeUsers >= seats.Value)
    throw new LicenseLimitException($"Лимит лицензии: {seats} пользователей.");
```

Поддерживаемые типы: `int`, `long`, `double`, `float`, `bool`, `Guid`, и любой `struct`, десериализуемый через `System.Text.Json`.

---

## 8. Hardware binding (привязка к машине)

Если при выпуске лицензии указан `hwFingerprint`, сервер будет проверять соответствие при каждой активации.

Отпечаток — SHA-256 от `MachineName | OSDescription | MAC-адрес | MachineGuid`:

```csharp
// Узнать отпечаток текущей машины (для вставки в панель при выпуске лицензии)
string fp = HwFingerprint.Get();
// → "3b4c1a8e9f02d67c..." (64 hex-символа)
```

**Порядок выдачи привязанной лицензии:**
1. Получи отпечаток с машины клиента (запусти `HwFingerprint.Get()` или `GET /api/v1/client/public-key` — там отпечаток не нужен, зайди в `activate`)
2. При выдаче лицензии вставь значение в поле **HW Fingerprint** в панели
3. При активации на другой машине сервер ответит `400`

Отключить проверку отпечатка на время тестов:

```csharp
new SigilClientOptions
{
    // ...
    HwFingerprint = "override-for-testing",
}
```

---

## 9. Оффлайн-режим

SDK не требует сети при каждом запуске.

**Как работает:**

1. При первой успешной активации/heartbeat сервер возвращает подписанный **heartbeat-маркер** (файл `.hb`).
2. Маркер содержит `exp = now + maxOfflineDays` (устанавливается в настройках шаблона, по умолчанию 30 дней).
3. На следующих запусках без сети SDK читает `.hb`-файл и проверяет `exp` локально.
4. Пока `now < marker.exp` → `Status = Active`.
5. Через `maxOfflineDays + 24h` → `Status = Expired`.

**Важно:** не удалять `.hb`-файл при обновлении или переустановке приложения.

---

## 10. Heartbeat и revoke

**Heartbeat** отправляется фоновым таймером автоматически раз в ~3600 секунд (с ±30 сек jitter).  
Запрос подписан HMAC-SHA256 с ключом = licenseKey (защита от replay-атак по временной метке ±5 мин).

**Revoke:** после того как оператор отзывает лицензию в панели:
- Следующий heartbeat получит `400` от сервера — маркер перестанет обновляться
- Приложение будет работать ещё `maxOfflineDays + 24h` от последнего успешного heartbeat
- Затем перейдёт в `Expired`

Немедленная блокировка не предусмотрена намеренно — чтобы не прерывать работу клиента посреди сессии.

---

## 11. Graceful shutdown (деактивация)

`DisposeAsync` отправляет `POST /client/deactivate` и освобождает слот активации.

```csharp
// Рекомендуемый способ — await using
await using var sigil = new SigilLicenseClient(options);
await sigil.InitializeAsync();
// ... работа приложения ...
// DisposeAsync вызывается автоматически
```

Если деактивация нужна по команде пользователя (перенос лицензии на другую машину):

```csharp
await sigil.DisposeAsync();
File.Delete(licensePath);
File.Delete(licensePath + ".hb");
```

---

## 12. Интеграция с .NET Generic Host / ASP.NET Core

### DI-регистрация

```csharp
// Program.cs
builder.Services.AddSingleton(new SigilClientOptions
{
    LicenseFilePath = builder.Configuration["Sigil:LicenseFile"]!,
    PublicKey       = Convert.FromHexString(builder.Configuration["Sigil:PublicKey"]!),
});

builder.Services.AddSingleton<SigilLicenseClient>(sp =>
    new SigilLicenseClient(sp.GetRequiredService<SigilClientOptions>()));
```

### Hosted service (инициализация при старте)

```csharp
public class LicenseHostedService : IHostedService
{
    private readonly SigilLicenseClient _sigil;
    private readonly IHostApplicationLifetime _lifetime;

    public LicenseHostedService(SigilLicenseClient sigil, IHostApplicationLifetime lifetime)
    {
        _sigil = sigil;
        _lifetime = lifetime;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        var ok = await _sigil.InitializeAsync(ct);

        if (!ok || _sigil.Status == LicenseStatus.Invalid)
        {
            // Лицензия не прошла — остановить хост
            _lifetime.StopApplication();
            throw new InvalidOperationException("License validation failed.");
        }
    }

    public async Task StopAsync(CancellationToken ct)
        => await _sigil.DisposeAsync();
}

// Регистрация
builder.Services.AddHostedService<LicenseHostedService>();
```

### Использование в контроллере

```csharp
[ApiController]
[Route("api/reports")]
public class ReportsController : ControllerBase
{
    private readonly SigilLicenseClient _sigil;

    public ReportsController(SigilLicenseClient sigil) => _sigil = sigil;

    [HttpGet("export")]
    public IActionResult Export()
    {
        if (_sigil.Status != LicenseStatus.Active)
            return StatusCode(402, "License required.");

        if (!_sigil.HasFeature("export"))
            return StatusCode(403, "Export feature not included in your license.");

        var limit = _sigil.GetConfig<int>("maxRows") ?? 1000;
        // ...
        return Ok();
    }
}
```

---

## 13. Сводная таблица API

| Метод | Описание |
|-------|----------|
| `new SigilLicenseClient(options)` | Создать клиент |
| `InitializeAsync(ct)` | Загрузить + верифицировать + активировать + запустить heartbeat |
| `Status` | Текущий статус (`Active / GracePeriod / Expired / Invalid / Revoked`) |
| `HasFeature("name")` | Проверить флаг из `config.features[]` |
| `GetConfig<T>("dot.path")` | Прочитать числовое/bool значение из конфига |
| `HwFingerprint.Get()` | Получить отпечаток текущей машины |
| `DisposeAsync()` | Graceful deactivate + остановить таймер |

---

## 14. Что нового в Фазе 3

По сравнению с Фазой 2 (только оффлайн-верификация) SDK теперь:

- Активирует лицензию на конкретной машине (`POST /client/activate`)
- Отправляет heartbeat каждый час с HMAC-аутентификацией
- Получает подписанный **heartbeat-маркер** (`sigil1-hb.<payload>.<sig>`) и сохраняет его атомарно
- Использует маркер для определения offline grace (вместо примитивного `_lastValidatedAt`)
- Вычисляет `HwFingerprint` кросс-платформенно (Windows Registry / `/etc/machine-id` / macOS ioreg)
- Отправляет `deactivate` при штатном завершении

Формат маркера: `sigil1-hb.<base64url(payload)>.<base64url(Ed25519 signature)>`  
Payload: `{ lic, key, iat, exp, mid }` — `exp = now + maxOfflineDays`.
