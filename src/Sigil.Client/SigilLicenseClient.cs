using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Sigil.Client;

/// <summary>
/// Client SDK for validating Sigil license tokens offline.
/// </summary>
public sealed class SigilLicenseClient
{
    private readonly byte[] _publicKey;
    private readonly string _licenseFilePath;

    private LicenseToken? _cachedToken;
    private DateTimeOffset _lastValidatedAt;

    public SigilLicenseClient(string licenseFilePath, byte[] publicKey)
    {
        _licenseFilePath = licenseFilePath;
        _publicKey = publicKey;
    }

    /// <summary>
    /// Loads and validates the license file.
    /// </summary>
    public bool Initialize()
    {
        if (!File.Exists(_licenseFilePath))
            return false;

        var tokenString = File.ReadAllText(_licenseFilePath);
        var token = ParseToken(tokenString);

        if (token is null)
            return false;

        if (!VerifySignature(token))
            return false;

        if (token.Payload.ExpiresAt < DateTimeOffset.UtcNow)
            return false;

        _cachedToken = token;
        _lastValidatedAt = DateTimeOffset.UtcNow;
        return true;
    }

    /// <summary>
    /// Checks if a feature is enabled in the license config.
    /// </summary>
    public bool HasFeature(string featureName)
    {
        if (_cachedToken is null)
            return false;

        try
        {
            var features = _cachedToken.Payload.Cfg.RootElement.GetProperty("features");
            foreach (var item in features.EnumerateArray())
            {
                if (item.GetString() == featureName)
                    return true;
            }
        }
        catch { /* feature list not present */ }

        return false;
    }

    /// <summary>
    /// Gets a numeric limit from the license config.
    /// </summary>
    public int? GetLimit(string limitName)
    {
        if (_cachedToken is null)
            return null;

        try
        {
            var limits = _cachedToken.Payload.Cfg.RootElement.GetProperty("limits");
            if (limits.TryGetProperty(limitName, out var prop))
                return prop.GetInt32();
        }
        catch { /* limits not present */ }

        return null;
    }

    /// <summary>
    /// Gets a config value by JSON path.
    /// </summary>
    public T? GetConfig<T>(string path) where T : struct
    {
        if (_cachedToken is null)
            return null;

        try
        {
            var element = _cachedToken.Payload.Cfg.RootElement;
            foreach (var segment in path.Split('.'))
            {
                element = element.GetProperty(segment);
            }
            return JsonSerializer.Deserialize<T>(element.GetRawText());
        }
        catch { return null; }
    }

    /// <summary>
    /// Current license status based on cached validation.
    /// </summary>
    public LicenseStatus Status
    {
        get
        {
            if (_cachedToken is null)
                return LicenseStatus.Invalid;

            var now = DateTimeOffset.UtcNow;

            if (_cachedToken.Payload.ExpiresAt < now)
                return LicenseStatus.Expired;

            // Grace period check (simplified — real impl uses heartbeat token)
            var graceUntil = _lastValidatedAt.AddDays(_cachedToken.Payload.MaxOfflineDays);
            if (graceUntil < now)
                return LicenseStatus.GracePeriod;

            return LicenseStatus.Active;
        }
    }

    private static LicenseToken? ParseToken(string tokenString)
    {
        if (!tokenString.StartsWith("sigil1.", StringComparison.Ordinal))
            return null;

        var parts = tokenString.Split('.');
        if (parts.Length != 4)
            return null;

        try
        {
            var headerJson = Base64UrlDecode(parts[1]);
            var payloadJson = Base64UrlDecode(parts[2]);
            var signature = Base64UrlDecode(parts[3]);

            var header = JsonSerializer.Deserialize<TokenHeader>(headerJson);
            var payload = JsonSerializer.Deserialize<LicensePayload>(payloadJson);

            if (header is null || payload is null)
                return null;

            return new LicenseToken(header, payload, signature);
        }
        catch
        {
            return null;
        }
    }

    private bool VerifySignature(LicenseToken token)
    {
        try
        {
            // Parse the raw token string
            var raw = File.ReadAllText(_licenseFilePath);
            var dot1 = raw.IndexOf('.');
            var dot2 = raw.IndexOf('.', dot1 + 1);
            var dot3 = raw.IndexOf('.', dot2 + 1);

            var message = Encoding.UTF8.GetBytes(raw[..dot3]);

            // Ed25519 verify using NSec.Cryptography
            var algorithm = new NSec.Cryptography.Ed25519();
            var publicKey = NSec.Cryptography.PublicKey.Import(
                algorithm, _publicKey, NSec.Cryptography.KeyBlobFormat.RawPublicKey);

            return algorithm.Verify(publicKey, message, token.Signature);
        }
        catch
        {
            return false;
        }
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var padded = input.Replace('-', '+').Replace('_', '/');
        switch (padded.Length % 4)
        {
            case 2: padded += "=="; break;
            case 3: padded += "="; break;
        }
        return Convert.FromBase64String(padded);
    }
}

public enum LicenseStatus
{
    Invalid,
    Active,
    GracePeriod,
    Expired,
    Revoked,
}

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
    public JsonDocument Cfg { get; set; } = JsonDocument.Parse("{}");

    public DateTimeOffset ExpiresAt => DateTimeOffset.FromUnixTimeSeconds(Exp);
}

sealed class LicenseToken
{
    public TokenHeader Header { get; }
    public LicensePayload Payload { get; }
    public byte[] Signature { get; }

    public LicenseToken(TokenHeader header, LicensePayload payload, byte[] signature)
    {
        Header = header;
        Payload = payload;
        Signature = signature;
    }
}
