# Sigil Webhooks

Webhooks let your application receive real-time HTTP notifications whenever a license event occurs. Sigil calls your endpoint with a signed JSON payload so you can react instantly — no polling required.

---

## Table of contents

1. [Registering an endpoint](#1-registering-an-endpoint)
2. [Payload format](#2-payload-format)
3. [Event types](#3-event-types)
4. [Verifying the signature](#4-verifying-the-signature)
5. [Retry policy](#5-retry-policy)
6. [Replaying a delivery](#6-replaying-a-delivery)
7. [API reference](#7-api-reference)

---

## 1. Registering an endpoint

Open **Settings → Webhooks** in the Sigil panel and click **Add endpoint**. Provide:

| Field | Required | Notes |
|-------|----------|-------|
| URL | ✓ | Must be publicly reachable HTTPS (or HTTP for local dev) |
| Secret | ✓ | ≥ 8 chars — used to sign every delivery |
| Description | — | Human-readable label |
| Events | ✓ | One or more event types to subscribe to |

You can also use the REST API:

```http
POST /api/v1/panel/webhooks
Authorization: <cookie>
Content-Type: application/json

{
  "url": "https://your-server.example/sigil-hook",
  "secret": "super-secret-value",
  "description": "Production hook",
  "events": ["license.issued", "license.revoked"]
}
```

---

## 2. Payload format

Every delivery is an HTTP `POST` request with `Content-Type: application/json` and this envelope:

```json
{
  "event": "license.issued",
  "occurredAt": "2026-05-20T14:00:00.000Z",
  "data": {
    // event-specific fields — see §3
  }
}
```

Additional headers on every request:

| Header | Value |
|--------|-------|
| `X-Sigil-Event` | Event type string, e.g. `license.issued` |
| `X-Sigil-Delivery` | UUID of the delivery record |
| `X-Sigil-Signature` | `sha256=<hex>` — HMAC-SHA256 of the raw body |

Your endpoint must return **any 2xx** status to mark the delivery successful. Any other status (or a network error) triggers the retry schedule.

---

## 3. Event types

### `license.issued`

Fired when a new license is created.

```json
{
  "licenseId": "...",
  "licenseKey": "SGIL-XXXX-XXXX-XXXX",
  "companyId": "...",
  "templateId": "...",
  "expiresAt": "2027-05-20T00:00:00Z"
}
```

### `license.revoked`

Fired when a license is manually revoked.

```json
{
  "licenseId": "...",
  "licenseKey": "SGIL-XXXX-XXXX-XXXX",
  "reason": "Subscription cancelled",
  "revokedAt": "2026-05-20T14:30:00Z"
}
```

### `license.expired`

Fired by the expiry monitor when a license passes its `expiresAt` date.

```json
{
  "licenseId": "...",
  "licenseKey": "SGIL-XXXX-XXXX-XXXX",
  "expiredAt": "2026-05-20T00:00:00Z"
}
```

### `license.activated`

Fired when the Sigil SDK activates a license on a new machine.

```json
{
  "licenseId": "...",
  "activationId": "...",
  "hwFingerprint": "a1b2c3...",
  "machineName": "DESKTOP-ABC",
  "clientIp": "1.2.3.4"
}
```

### `license.heartbeat_missed`

Fired by the heartbeat monitor when no heartbeat has been received within the expected window.

```json
{
  "licenseId": "...",
  "activationId": "...",
  "lastHeartbeatAt": "2026-05-19T10:00:00Z"
}
```

---

## 4. Verifying the signature

Compute `HMAC-SHA256(key=<your_secret>, message=<raw_request_body_bytes>)` and compare the hex digest with the value in `X-Sigil-Signature` after stripping the `sha256=` prefix.

> **Always verify using a constant-time comparison** to prevent timing attacks.

### Node.js

```js
import { createHmac, timingSafeEqual } from 'node:crypto'

function verify(secret, rawBody, header) {
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  const received = header.startsWith('sha256=') ? header.slice(7) : ''
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
}
```

### Python

```python
import hmac, hashlib

def verify(secret: str, raw_body: bytes, header: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    received = header.removeprefix('sha256=')
    return hmac.compare_digest(expected, received)
```

### C#

```csharp
using System.Security.Cryptography;
using System.Text;

bool Verify(string secret, byte[] body, string header)
{
    var key = Encoding.UTF8.GetBytes(secret);
    var expected = HMACSHA256.HashData(key, body);
    var expectedHex = Convert.ToHexString(expected).ToLowerInvariant();
    var received = header.StartsWith("sha256=") ? header[7..] : "";
    return CryptographicOperations.FixedTimeEquals(
        Encoding.UTF8.GetBytes(expectedHex),
        Encoding.UTF8.GetBytes(received));
}
```

---

## 5. Retry policy

If your endpoint does not return a 2xx, Sigil retries with exponential back-off:

| Attempt | Delay before retry |
|---------|--------------------|
| 1 (initial) | — (immediate) |
| 2 | +1 minute |
| 3 | +5 minutes |
| 4 | +30 minutes |
| 5 | +2 hours |
| 6 | +12 hours |
| > 6 | **Failed** (no more retries) |

The dispatch worker polls every 15 seconds in batches of 20.

---

## 6. Replaying a delivery

Any delivery — whether succeeded or failed — can be replayed from the UI or the API. Replaying resets `attemptCount` to 0 and schedules an immediate re-send.

```http
POST /api/v1/panel/webhooks/deliveries/{deliveryId}/replay
```

---

## 7. API reference

All endpoints require an authenticated session cookie.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/panel/webhooks` | List all endpoints |
| `GET` | `/api/v1/panel/webhooks/{id}` | Get a single endpoint |
| `POST` | `/api/v1/panel/webhooks` | Create endpoint |
| `PATCH` | `/api/v1/panel/webhooks/{id}` | Update endpoint (partial) |
| `DELETE` | `/api/v1/panel/webhooks/{id}` | Delete endpoint (cascades deliveries) |
| `GET` | `/api/v1/panel/webhooks/{id}/deliveries` | List deliveries (`?limit=50`) |
| `POST` | `/api/v1/panel/webhooks/deliveries/{deliveryId}/replay` | Replay a delivery |
| `GET` | `/api/v1/panel/webhooks/event-types` | List all supported event types |
