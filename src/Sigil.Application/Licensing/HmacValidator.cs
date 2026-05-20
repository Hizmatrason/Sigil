using System.Security.Cryptography;
using System.Text;

namespace Sigil.Application.Licensing;

/// <summary>
/// Validates HMAC-SHA256 request signatures for client API endpoints.
///
/// Scheme:
///   Key     = UTF-8 bytes of the license key (e.g. "SGIL-AB12-CD34-EF56")
///   Message = unix-seconds timestamp as a decimal string
///   Header  = X-Sigil-Timestamp: &lt;unix_seconds&gt;
///             X-Sigil-Signature: v1=&lt;hex_hmac&gt;
///
/// Server rejects timestamps outside ±5 minutes to prevent replay attacks.
/// </summary>
public static class HmacValidator
{
    private static readonly TimeSpan MaxSkew = TimeSpan.FromMinutes(5);

    public static void Validate(string licenseKey, string? timestampHeader, string? signatureHeader)
    {
        if (string.IsNullOrEmpty(timestampHeader) || string.IsNullOrEmpty(signatureHeader))
            throw new UnauthorizedAccessException("Missing HMAC headers (X-Sigil-Timestamp, X-Sigil-Signature)");

        if (!long.TryParse(timestampHeader, out var ts))
            throw new UnauthorizedAccessException("Invalid X-Sigil-Timestamp");

        var requestTime = DateTimeOffset.FromUnixTimeSeconds(ts);
        var skew = (DateTimeOffset.UtcNow - requestTime).Duration();
        if (skew > MaxSkew)
            throw new UnauthorizedAccessException("Request timestamp too far from server time");

        if (!signatureHeader.StartsWith("v1=", StringComparison.Ordinal))
            throw new UnauthorizedAccessException("Unsupported signature version");

        var receivedHex = signatureHeader[3..];

        var keyBytes = Encoding.UTF8.GetBytes(licenseKey);
        var messageBytes = Encoding.UTF8.GetBytes(timestampHeader);
        var expected = HMACSHA256.HashData(keyBytes, messageBytes);
        var expectedHex = Convert.ToHexString(expected).ToLowerInvariant();

        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(expectedHex),
                Encoding.ASCII.GetBytes(receivedHex.ToLowerInvariant())))
        {
            throw new UnauthorizedAccessException("Invalid HMAC signature");
        }
    }
}
