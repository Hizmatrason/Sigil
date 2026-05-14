namespace Sigil.Application.Licensing;

/// <summary>
/// Represents the payload section of a sigil1 license token.
/// </summary>
public sealed class SigilTokenPayload
{
    /// <summary>License ID.</summary>
    public required Guid Lic { get; init; }

    /// <summary>Human-readable license key (e.g., "SGIL-AB12-CD34-EF56").</summary>
    public required string Key { get; init; }

    /// <summary>Template ID.</summary>
    public required Guid Tpl { get; init; }

    /// <summary>Template version number.</summary>
    public required int TplV { get; init; }

    /// <summary>Config version (= license_versions.version).</summary>
    public required int CfgV { get; init; }

    /// <summary>Issuer URL.</summary>
    public required string Iss { get; init; }

    /// <summary>Subject (company_id of the licensee).</summary>
    public required Guid Sub { get; init; }

    /// <summary>Issued at (Unix seconds).</summary>
    public required long Iat { get; init; }

    /// <summary>Not before (Unix seconds).</summary>
    public required long Nbf { get; init; }

    /// <summary>Hard expiry (Unix seconds, license.expires_at).</summary>
    public required long Exp { get; init; }

    /// <summary>Max offline days before degraded mode.</summary>
    public required int MaxOfflineDays { get; init; }

    /// <summary>Hardware fingerprint (null if not bound).</summary>
    public string? Hwfp { get; init; }

    /// <summary>Arbitrary JSON config per template schema.</summary>
    public required string Cfg { get; init; }

    /// <summary>Revocation marker; always null in normal tokens.</summary>
    public string? Rev { get; init; }
}
