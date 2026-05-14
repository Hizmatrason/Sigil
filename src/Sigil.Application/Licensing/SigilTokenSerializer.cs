using System.Globalization;
using System.Text;
using System.Text.Json;

namespace Sigil.Application.Licensing;

/// <summary>
/// Serializes and deserializes sigil1 license tokens.
/// Format: sigil1.&lt;base64url(header)&gt;.&lt;base64url(payload)&gt;.&lt;base64url(signature)&gt;
/// </summary>
public static class SigilTokenSerializer
{
    private const string Prefix = "sigil1.";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Serializes a license token: header + payload → JSON → base64url, signs with ISigner.
    /// </summary>
    public static async Task<string> SerializeAsync(
        SigilTokenHeader header,
        SigilTokenPayload payload,
        Func<ReadOnlyMemory<byte>, Task<byte[]>> signFunc)
    {
        var headerJson = JsonSerializer.SerializeToUtf8Bytes(header, JsonOptions);
        var payloadJson = JsonSerializer.SerializeToUtf8Bytes(payload, JsonOptions);

        var headerB64 = Base64UrlEncode(headerJson);
        var payloadB64 = Base64UrlEncode(payloadJson);

        // Sign over "headerB64.payloadB64" (UTF-8 bytes)
        var message = Encoding.ASCII.GetBytes($"{headerB64}.{payloadB64}");
        var signature = await signFunc(message);

        var signatureB64 = Base64UrlEncode(signature);

        return $"{Prefix}{headerB64}.{payloadB64}.{signatureB64}";
    }

    /// <summary>
    /// Deserializes a sigil1 token string into its components (without verification).
    /// </summary>
    public static (SigilTokenHeader Header, SigilTokenPayload Payload, byte[] Signature) Deserialize(string token)
    {
        if (!token.StartsWith(Prefix, StringComparison.Ordinal))
            throw new FormatException($"Token must start with '{Prefix}'.");

        var rest = token[Prefix.Length..];
        var parts = rest.Split('.');

        if (parts.Length != 3)
            throw new FormatException("Token must have 3 dot-separated parts after prefix.");

        var headerJson = Base64UrlDecode(parts[0]);
        var payloadJson = Base64UrlDecode(parts[1]);
        var signature = Base64UrlDecode(parts[2]);

        var header = JsonSerializer.Deserialize<SigilTokenHeader>(headerJson, JsonOptions)
            ?? throw new FormatException("Failed to deserialize token header.");

        var payload = JsonSerializer.Deserialize<SigilTokenPayload>(payloadJson, JsonOptions)
            ?? throw new FormatException("Failed to deserialize token payload.");

        return (header, payload, signature);
    }

    /// <summary>
    /// Extracts only the signing message bytes from a serialized token
    /// (everything between prefix and last dot, encoded as ASCII).
    /// </summary>
    public static byte[] ExtractSigningMessage(string token)
    {
        if (!token.StartsWith(Prefix, StringComparison.Ordinal))
            throw new FormatException($"Token must start with '{Prefix}'.");

        var rest = token[Prefix.Length..];
        var lastDot = rest.LastIndexOf('.');
        if (lastDot < 0)
            throw new FormatException("Token must contain at least one dot after prefix.");

        return Encoding.ASCII.GetBytes(rest[..lastDot]);
    }

    /// <summary>
    /// Extracts the signature bytes from a serialized token.
    /// </summary>
    public static byte[] ExtractSignature(string token)
    {
        if (!token.StartsWith(Prefix, StringComparison.Ordinal))
            throw new FormatException($"Token must start with '{Prefix}'.");

        var rest = token[Prefix.Length..];
        var lastDot = rest.LastIndexOf('.');
        if (lastDot < 0)
            throw new FormatException("Token must contain at least one dot after prefix.");

        return Base64UrlDecode(rest[(lastDot + 1)..]);
    }

    private static string Base64UrlEncode(byte[] data)
    {
        return Convert.ToBase64String(data)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string encoded)
    {
        var base64 = encoded
            .Replace('-', '+')
            .Replace('_', '/');

        // Pad with '=' to make length a multiple of 4
        var padding = (4 - base64.Length % 4) % 4;
        base64 = base64.PadRight(base64.Length + padding, '=');

        return Convert.FromBase64String(base64);
    }
}
