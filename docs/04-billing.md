# 04 — Биллинг

Биллинг = «как Sigil зарабатывает с tenant'ов» + «как tenant учитывает свои лицензии». В v1 покрываем оба пласта по-минимуму.

## Уровни

### Уровень 1 — Sigil ↔ Tenant (внешний биллинг)

Компании платят Sigil за подписку. Это управляется через `plans` / `subscriptions` / `invoices`.

- **Тарифы (планы):**
  - `free` — до 3 шаблонов, до 10 активных лицензий.
  - `starter` — до 25 шаблонов, до 250 лицензий.
  - `pro` — до 200 шаблонов, до 5000 лицензий, custom branding.
  - `enterprise` — индивидуальный (`price_cents = NULL`, ручной инвойсинг), HSM/Vault, SSO, SLA.

  Конкретные числа — заглушки, переопределяются в админ-панели оператора Sigil.

- **Лимиты** хранятся в `plans.features` как JSON: `{ "max_templates": 25, "max_licenses": 250, "custom_branding": false, "sso": false }`.

- **Жизненный цикл подписки:**
  ```
  trialing ──(after trial_end)──▶ active ──(card declined)──▶ past_due ──(no recovery in 14d)──▶ canceled
                                    │
                                    └─(cancel_at_period_end)──▶ canceled (на period_end)
  ```
  Триал — 14 дней; включается автоматически при создании корневой компании оператором.

- **Платёжный провайдер:** только ручные/банковские платежи, никаких SaaS-провайдеров (Stripe и аналоги осознанно исключены — нарушают self-hosted-политику). Поток:
  - PDF-инвойсы через QuestPDF (полностью offline-генерация).
  - Tenant получает инвойс с реквизитами и QR-кодом для оплаты.
  - Оператор Sigil вручную помечает инвойс `paid` после поступления оплаты (либо автоматически через банковский reconciliation-импорт CSV из ДБО).
  - Заложим интерфейс `IPaymentProvider` с тремя реализациями:
    - `ManualPaymentProvider` — основная.
    - `BankImportPaymentProvider` — парсит CSV из 1С/банк-клиента, матчит по номеру инвойса.
    - `WebhookPaymentProvider` — для случая, когда tenant сам уведомляет об оплате через подписанный webhook (например, из своего платежного шлюза).

- **Усиление лимитов:** перед каждым `IssueLicenseCommand` / `CreateTemplateCommand` сервис `EntitlementService` проверяет `current_count < plan.max_*`. Превышение → `403 + plan_quota_exceeded`.

### Уровень 2 — Tenant ↔ его собственные клиенты (внутренний биллинг)

Tenant может перепродавать лицензии своим клиентам. В v1 Sigil **не выставляет инвойсы за tenant'а** — у tenant'а есть только:

- Поле `license.metadata.price_quoted` для собственного учёта.
- Экспорт CSV/JSON всех лицензий с фильтрами для интеграции с их собственной CRM.

В v2 можно добавить полноценный sub-billing с white-label PDF, но это явно за пределами MVP.

## Метрики метеринга

Считаем для каждого корневого tenant'а (агрегаты в materialized view, обновление раз в час):

| Метрика | Источник | Зачем |
|---------|----------|-------|
| `active_licenses` | `licenses` status='active' | Лимит плана |
| `templates_count` | `license_templates` status='active' | Лимит плана |
| `heartbeats_per_month` | `heartbeats` group by month | Antifraud, ценообразование v2 |
| `child_companies_count` | `companies` где path содержит root | Информативно |

## Шаблоны лицензий и pricing внутри них

В шаблоне можно задать **рекомендуемую тарификацию** для конечных лицензий — это просто метаданные для удобства tenant'а, не часть подписки на Sigil:

```jsonc
{
  "pricing_hint": {
    "model": "flat",              // flat / per_seat / metered
    "currency": "USD",
    "amount": 1500,
    "billing_period": "year"
  }
}
```

Tenant видит это в редакторе при создании лицензии и может переопределить per-license.

## Инвойсинг (поток для v1)

1. Раз в сутки `BillingCycleJob`:
   - Берёт все `subscriptions` где `current_period_end <= now()`.
   - Создаёт `invoice` с одной строкой `plan.name × 1` и генерирует PDF в MinIO.
   - Уведомляет tenant'а (email через self-hosted SMTP).
   - Если оплата не поступила в течение N дней → `past_due`.
   - Если 14 дней `past_due` → `canceled` + блокировка выдачи новых лицензий (существующие — продолжают работать до конца их `expires_at`).
2. Tenant видит инвойсы в `/billing/invoices`, скачивает PDF.
3. **Признание оплаты** (на выбор):
   - Оператор вручную помечает инвойс `paid` в operator-UI.
   - Импорт банковской выписки CSV — `BankImportPaymentProvider` парсит, матчит по номеру инвойса в назначении платежа.
   - Tenant вызывает webhook от своего платежного шлюза (если он у них есть), подписанный pre-shared секретом.

## Конфигурация в коде (`Sigil.Application/Billing`)

```csharp
public interface IPaymentProvider
{
    Task<PaymentResult> RecordPaymentAsync(Invoice invoice, Money amount, string reference, CancellationToken ct);
}

public sealed class ManualPaymentProvider : IPaymentProvider { /* основной */ }
public sealed class BankImportPaymentProvider : IPaymentProvider { /* CSV из ДБО */ }
public sealed class WebhookPaymentProvider : IPaymentProvider { /* tenant сам уведомляет */ }
```

## Edge cases

- **Понижение тарифа** при превышении текущих лимитов — запрещаем понижение до тех пор, пока tenant сам не сократит ресурсы. UI показывает «archive 12 licenses to downgrade».
- **Триал заканчивается, лицензии активны** — лицензии продолжают работать (мы их уже подписали), но новые не выпускаются и сам tenant не может логиниться в панель до оплаты.
- **Изменение цены плана** — существующие подписки остаются на старом прайсе до явного `migrate`. Новые — на новом.
