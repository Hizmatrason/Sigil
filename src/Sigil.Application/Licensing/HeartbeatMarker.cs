using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Sigil.Application.Licensing;

/// <summary>
/// A signed offline-grace marker issued to the SDK after each successful heartbeat.
/// Format: sigil1-hb.&lt;base64url(payload)&gt;.&lt;base64url(ed25519_signature)&gt;
/// </summary>
public static class HeartbeatMarker
{
    private const string Prefix = "sigil1-hb.";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public sealed class Payload
    {
        public required Guid Lic { get; init; }
        public required string Key { get; init; }
        public required long Iat { get; init; }   // unix seconds — issued at
        public required long Exp { get; init; }   // unix seconds — valid until (iat + maxOfflineDays)
        public string? Mid { get; init; }          // machine id / hw fingerprint
    }

    /// <summary>
    /// Build and sign a heartbeat marker.
    /// </summary>
    public static async Task<string> IssueAsync(
        Guid licenseId,
        string licenseKey,
        string? hwFingerprint,
        int maxOfflineDays,
        Func<ReadOnlyMemory<byte>, Task<byte[]>> signFunc)
    {
        var now = DateTimeOffset.UtcNow;
        var payload = new Payload
        {
            Lic = licenseId,
            Key = licenseKey,
            Iat = now.ToUnixTimeSeconds(),
            Exp = now.AddDays(maxOfflineDays).ToUnixTimeSeconds(),
            Mid = hwFingerprint,
        };

        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);
        var payloadB64 = Base64UrlEncode(payloadBytes);

        var message = Encoding.ASCII.GetBytes(payloadB64);
        var signature = await signFunc(message);
        var sigB64 = Base64UrlEncode(signature);

        return $"{Prefix}{payloadB64}.{sigB64}";
    }

    /// <summary>
    /// Parse the payload from a heartbeat marker string (no signature verification).
    /// </summary>
    public static Payload? ParsePayload(string marker)
    {
        if (!marker.StartsWith(Prefix, StringComparison.Ordinal))
            return null;

        var rest = marker[Prefix.Length..];
        var dot = rest.IndexOf('.');
        if (dot < 0) return null;

        try
        {
            var payloadBytes = Base64UrlDecode(rest[..dot]);
            return JsonSerializer.Deserialize<Payload>(payloadBytes, JsonOptions);
        }
        catch { return null; }
    }

    private static string Base64UrlEncode(byte[] data)
        => Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string encoded)
    {
        var base64 = encoded.Replace('-', '+').Replace('_', '/');
        var padding = (4 - base64.Length % 4) % 4;
        base64 = base64.PadRight(base64.Length + padding, '=');
        return Convert.FromBase64String(base64);
    }
}
