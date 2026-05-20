using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sigil.Client;

/// <summary>
/// Client SDK for validating and maintaining Sigil license tokens.
///
/// Workflow:
///   1. Call <see cref="InitializeAsync"/> on startup — loads + verifies the local token,
///      activates with the server if not already activated, and starts the background heartbeat.
///   2. Read <see cref="Status"/> to gate features.
///   3. Call <see cref="DisposeAsync"/> on shutdown — sends a graceful deactivate and stops the timer.
/// </summary>
public sealed class SigilLicenseClient : IAsyncDisposable
{
    private readonly SigilClientOptions _options;
    private readonly HttpClient _http;

    private LicenseToken? _token;
    private HeartbeatMarkerPayload? _marker;
    private Guid _activationId;

    private Timer? _heartbeatTimer;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly Random _jitter = new();

    private const string ServerUrl = "https://sigil.hizmatrason.tj";

    public SigilLicenseClient(SigilClientOptions options, HttpClient? http = null)
    {
        _options = options;
        _http = http ?? new HttpClient { BaseAddress = new Uri(ServerUrl) };
    }

    // ── Status ────────────────────────────────────────────────────────────────

    /// <summary>Current license status based on local token and last heartbeat marker.</summary>
    public LicenseStatus Status
    {
        get
        {
            if (_token is null) return LicenseStatus.Invalid;

            var now = DateTimeOffset.UtcNow;

            if (_token.Payload.ExpiresAt < now)
                return LicenseStatus.Expired;

            if (_marker is not null)
            {
                var validUntil = DateTimeOffset.FromUnixTimeSeconds(_marker.Exp);
                if (now <= validUntil) return LicenseStatus.Active;

                // Within a 24-hour grace buffer after marker expiry
                if (now <= validUntil.AddHours(24)) return LicenseStatus.GracePeriod;

                return LicenseStatus.Expired;
            }

            // No marker yet — use initial offline window from last validated time
            var graceUntil = _lastValidatedAt.AddDays(_token.Payload.MaxOfflineDays);
            if (now <= graceUntil) return LicenseStatus.Active;
            if (now <= graceUntil.AddDays(1)) return LicenseStatus.GracePeriod;
            return LicenseStatus.Expired;
        }
    }

    private DateTimeOffset _lastValidatedAt;

    // ── Config helpers ────────────────────────────────────────────────────────

    public bool HasFeature(string featureName)
    {
        if (_token is null) return false;
        try
        {
            var features = JsonDocument.Parse(_token.Payload.Cfg).RootElement.GetProperty("features");
            foreach (var item in features.EnumerateArray())
                if (item.GetString() == featureName) return true;
        }
        catch { }
        return false;
    }

    public T? GetConfig<T>(string path) where T : struct
    {
        if (_token is null) return null;
        try
        {
            var element = JsonDocument.Parse(_token.Payload.Cfg).RootElement;
            foreach (var segment in path.Split('.'))
                element = element.GetProperty(segment);
            return JsonSerializer.Deserialize<T>(element.GetRawText());
        }
        catch { return null; }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /// <summary>
    /// Load token from disk, verify signature, activate with server, start heartbeat loop.
    /// Returns false if the license file is missing, corrupted, or already expired.
    /// </summary>
    public async Task<bool> InitializeAsync(CancellationToken ct = default)
    {
        if (!File.Exists(_options.LicenseFilePath))
            return false;

        var tokenString = await File.ReadAllTextAsync(_options.LicenseFilePath, ct);
        _token = ParseToken(tokenString);
        if (_token is null) return false;

        if (!VerifySignature(tokenString, _options.PublicKey))
            return false;

        if (_token.Payload.ExpiresAt < DateTimeOffset.UtcNow)
            return false;

        _lastValidatedAt = DateTimeOffset.UtcNow;

        // Load cached heartbeat marker if available
        _marker = LoadMarker();

        // Activate and start heartbeat
        try
        {
            var activated = await ActivateAsync(ct);
            if (activated.ActivationId != Guid.Empty)
            {
                _activationId = activated.ActivationId;
                ApplyMarker(activated.HeartbeatToken);

                var intervalMs = (activated.HeartbeatIntervalSeconds + _jitter.Next(-30, 30)) * 1000;
                _heartbeatTimer = new Timer(
                    _ => _ = SendHeartbeatAsync(CancellationToken.None),
                    null,
                    intervalMs,
                    intervalMs);
            }
        }
        catch
        {
            // Server unreachable — rely on cached marker for offline grace
        }

        return true;
    }

    public async ValueTask DisposeAsync()
    {
        if (_heartbeatTimer is not null)
        {
            await _heartbeatTimer.DisposeAsync();
            _heartbeatTimer = null;
        }

        if (_activationId != Guid.Empty && _token is not null)
        {
            try { await DeactivateAsync(CancellationToken.None); }
            catch { /* best-effort */ }
        }

        _lock.Dispose();
        _http.Dispose();
    }

    // ── Server calls ──────────────────────────────────────────────────────────

    private async Task<ActivateResponse> ActivateAsync(CancellationToken ct)
    {
        var hwFp = _options.HwFingerprint ?? HwFingerprint.Get();
        var req = new { licenseKey = _token!.Payload.Key, hwFingerprint = hwFp, machineName = Environment.MachineName };
        var resp = await _http.PostAsJsonAsync("/api/v1/client/activate", req, ct);
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<ActivateResponse>(ct))!;
    }

    private async Task SendHeartbeatAsync(CancellationToken ct)
    {
        if (_token is null || _activationId == Guid.Empty) return;

        await _lock.WaitAsync(ct);
        try
        {
            var key = _token.Payload.Key;
            var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
            var sig = ComputeHmac(key, ts);

            var req = new { licenseKey = key, activationId = _activationId };
            var msg = new HttpRequestMessage(HttpMethod.Post, "/api/v1/client/heartbeat")
            {
                Content = JsonContent.Create(req),
            };
            msg.Headers.Add("X-Sigil-Timestamp", ts);
            msg.Headers.Add("X-Sigil-Signature", $"v1={sig}");

            var resp = await _http.SendAsync(msg, ct);
            if (!resp.IsSuccessStatusCode) return;

            var hbResp = await resp.Content.ReadFromJsonAsync<HeartbeatResponse>(ct);
            if (hbResp?.HeartbeatToken is not null)
                ApplyMarker(hbResp.HeartbeatToken);
        }
        catch { /* network error — rely on cached marker */ }
        finally { _lock.Release(); }
    }

    private async Task DeactivateAsync(CancellationToken ct)
    {
        var key = _token!.Payload.Key;
        var ts = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(System.Globalization.CultureInfo.InvariantCulture);
        var sig = ComputeHmac(key, ts);

        var req = new { licenseKey = key, activationId = _activationId };
        var msg = new HttpRequestMessage(HttpMethod.Post, "/api/v1/client/deactivate")
        {
            Content = JsonContent.Create(req),
        };
        msg.Headers.Add("X-Sigil-Timestamp", ts);
        msg.Headers.Add("X-Sigil-Signature", $"v1={sig}");

        await _http.SendAsync(msg, ct);
    }

    // ── Marker persistence ────────────────────────────────────────────────────

    private string MarkerPath => _options.LicenseFilePath + ".hb";

    private void ApplyMarker(string markerToken)
    {
        _marker = ParseMarkerPayload(markerToken);
        AtomicWriteFile(MarkerPath, markerToken);
    }

    private HeartbeatMarkerPayload? LoadMarker()
    {
        if (!File.Exists(MarkerPath)) return null;
        try
        {
            var text = File.ReadAllText(MarkerPath);
            return ParseMarkerPayload(text);
        }
        catch { return null; }
    }

    private static void AtomicWriteFile(string path, string content)
    {
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, content);
        File.Move(tmp, path, overwrite: true);
    }

    // ── Crypto helpers ────────────────────────────────────────────────────────

    private static string ComputeHmac(string licenseKey, string timestamp)
    {
        var key = Encoding.UTF8.GetBytes(licenseKey);
        var msg = Encoding.UTF8.GetBytes(timestamp);
        return Convert.ToHexString(HMACSHA256.HashData(key, msg)).ToLowerInvariant();
    }

    private static LicenseToken? ParseToken(string tokenString)
    {
        if (!tokenString.StartsWith("sigil1.", StringComparison.Ordinal)) return null;
        var parts = tokenString.Split('.');
        if (parts.Length != 4) return null;
        try
        {
            var header = JsonSerializer.Deserialize<TokenHeader>(Base64UrlDecode(parts[1]));
            var payload = JsonSerializer.Deserialize<LicensePayload>(Base64UrlDecode(parts[2]));
            var sig = Base64UrlDecode(parts[3]);
            if (header is null || payload is null) return null;
            return new LicenseToken(header, payload, sig);
        }
        catch { return null; }
    }

    private static bool VerifySignature(string tokenString, byte[] publicKey)
    {
        try
        {
            var dot3 = tokenString.LastIndexOf('.');
            var message = Encoding.UTF8.GetBytes(tokenString[..dot3]);
            var sig = Base64UrlDecode(tokenString[(dot3 + 1)..]);

            var algorithm = new NSec.Cryptography.Ed25519();
            var key = NSec.Cryptography.PublicKey.Import(
                algorithm, publicKey, NSec.Cryptography.KeyBlobFormat.RawPublicKey);
            return algorithm.Verify(key, message, sig);
        }
        catch { return false; }
    }

    private static HeartbeatMarkerPayload? ParseMarkerPayload(string marker)
    {
        const string prefix = "sigil1-hb.";
        if (!marker.StartsWith(prefix, StringComparison.Ordinal)) return null;
        var rest = marker[prefix.Length..];
        var dot = rest.IndexOf('.');
        if (dot < 0) return null;
        try
        {
            return JsonSerializer.Deserialize<HeartbeatMarkerPayload>(
                Base64UrlDecode(rest[..dot]),
                JsonOptions.CamelCase);
        }
        catch { return null; }
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        var padding = (4 - padded.Length % 4) % 4;
        padded = padded.PadRight(padded.Length + padding, '=');
        return Convert.FromBase64String(padded);
    }
}

// ── Options ───────────────────────────────────────────────────────────────────

public sealed class SigilClientOptions
{
    public required string LicenseFilePath { get; init; }
    public required byte[] PublicKey { get; init; }

    /// <summary>
    /// Override hardware fingerprint. If null, <see cref="HwFingerprint.Get"/> is used.
    /// </summary>
    public string? HwFingerprint { get; init; }
}

// ── License status ────────────────────────────────────────────────────────────

public enum LicenseStatus
{
    Invalid,
    Active,
    GracePeriod,
    Expired,
    Revoked,
}

// ── JSON options ──────────────────────────────────────────────────────────────

file static class JsonOptions
{
    public static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };
}

// ── Internal token model ──────────────────────────────────────────────────────

sealed class TokenHeader
{
    public string Alg { get; set; } = "Ed25519";
    public string Kid { get; set; } = "";
    public string Typ { get; set; } = "sigil-license";
    public int Ver { get; set; } = 1;
}

sealed class LicensePayload
{
    public string Lic { get; set; } = "";
    public string Key { get; set; } = "";
    public string Tpl { get; set; } = "";
    public int TplV { get; set; }
    public int CfgV { get; set; }
    public string Iss { get; set; } = "";
    public string Sub { get; set; } = "";
    public long Iat { get; set; }
    public long Nbf { get; set; }
    public long Exp { get; set; }
    public int MaxOfflineDays { get; set; }
    public string? Hwfp { get; set; }
    public string Cfg { get; set; } = "{}";

    public DateTimeOffset ExpiresAt => DateTimeOffset.FromUnixTimeSeconds(Exp);
}

sealed class LicenseToken(TokenHeader header, LicensePayload payload, byte[] signature)
{
    public TokenHeader Header { get; } = header;
    public LicensePayload Payload { get; } = payload;
    public byte[] Signature { get; } = signature;
}

sealed class HeartbeatMarkerPayload
{
    public Guid Lic { get; set; }
    public string Key { get; set; } = "";
    public long Iat { get; set; }
    public long Exp { get; set; }
    public string? Mid { get; set; }
}

// ── API response models ───────────────────────────────────────────────────────

sealed class ActivateResponse
{
    public Guid ActivationId { get; set; }
    public string HeartbeatToken { get; set; } = "";
    public int HeartbeatIntervalSeconds { get; set; }
    public int MaxOfflineDays { get; set; }
}

sealed class HeartbeatResponse
{
    public string HeartbeatToken { get; set; } = "";
}
