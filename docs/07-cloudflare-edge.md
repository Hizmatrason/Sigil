# 07 — Cloudflare (edge-only)

> Этот документ заменяет ранее запланированную «авто-выдачу поддоменов».
> **Поддомены на лицензию отменены** — все клиентские SDK обращаются к единственному API-эндпоинту `sigil.hizmatrason.tj` (см. [06-api.md](06-api.md)).
> Cloudflare остаётся, но **только в роли edge** — без интеграции по API.

## Что использует Sigil из Cloudflare

| Возможность | Зачем | Как настроено |
|-------------|-------|---------------|
| **DNS-зона `sigil.hizmatrason.tj`** | Резолв `api.sigil.*`, `panel.sigil.*` | Записи (A / CNAME) **заводятся вручную** в Cloudflare dashboard, не через API |
| **Universal TLS** | Бесплатный сертификат на edge | Включено по умолчанию (proxied=true) |
| **WAF + DDoS** | Защита API и панели | Managed Rules + кастомные правила (rate-limit `/auth/login`, `/client/heartbeat`) |
| **Rate Limiting Rules** | Ограничение на /client/* и /auth/* | Конфигурируется в UI Cloudflare |
| **Bot Fight Mode** | Базовая защита от ботов | Включено |
| **Cloudflare Tunnel** (опционально) | Origin не публикует IP в интернет | `cloudflared` контейнер на self-hosted VM подключается к Cloudflare; firewall сервера блокирует весь входящий трафик |

## Что НЕ используется

- ❌ Cloudflare API для DNS-записей.
- ❌ Workers / Pages.
- ❌ KV / R2 / Durable Objects.
- ❌ Cloudflare Access (можно добавить позже для operator-портала).
- ❌ Cloudflare Stream / Images.

## Конфигурация origin

Origin = self-hosted VM с двумя контейнерами:

- `nginx` (или Caddy) — отдаёт статику панели и проксирует `/api/*` → `Sigil.Api`.
- `Sigil.Api` (Kestrel) — слушает на `127.0.0.1:5000`.

Один публичный домен: **`sigil.hizmatrason.tj`**.

- `https://sigil.hizmatrason.tj/` → панель (статика).
- `https://sigil.hizmatrason.tj/api/v1/panel/*` → Panel API.
- `https://sigil.hizmatrason.tj/api/v1/client/*` → Client API (для SDK).

При желании можно разделить на `panel.*` и `api.*` — но в MVP одного хоста достаточно. Origin-сертификат — либо Cloudflare Origin Certificate (15-летний), либо Let's Encrypt через `caddy` / `nginx-proxy-manager`.

## Доступ к origin

- **Вариант A (proxied + IP allow-list):** в firewall (`ufw` / `iptables` / cloud security group) разрешаем только [IP-диапазоны Cloudflare](https://www.cloudflare.com/ips/). Прямые обращения по IP блокируются.
- **Вариант B (Cloudflare Tunnel):** в Cloudflare dashboard создаётся tunnel, на сервере запускается `cloudflared` контейнер с привязанным `tunnel.json`. Никакой публикации портов наружу не требуется — Cloudflare сам подключается к origin изнутри tunnel'а. **Рекомендуется** — проще и безопаснее.

## Что осталось от прежнего плана

Из удалённой функциональности «авто-выдача поддоменов» сохраняется:

- Идея, что каждая лицензия может содержать в своём `cfg` произвольные URL'ы клиента (`api_base`, `auth_url`, ...) — это часть JSON-конфига лицензии, не Sigil-инфраструктура.
- Tenant сам решает, как раздавать свои продукты заказчикам (вручную, через свой DNS-провайдер, через Cloudflare-аккаунт самого tenant'а) — Sigil в этом не участвует.

Удалены: `dns_records` таблица, `DnsProvisionJob`, поля `base_domain` / `cloudflare_zone_id` / `subdomain`, эндпоинты `/api/v1/panel/licenses/{id}/dns/*`.
