namespace Sigil.Application.Licensing;

/// <summary>
/// Represents the header section of a sigil1 license token.
/// </summary>
public sealed class SigilTokenHeader
{
    public const string Algorithm = "Ed25519";
    public const string TokenType = "sigil-license";
    public const int Version = 1;

    /// <summary>Signing algorithm (always "Ed25519").</summary>
    public string Alg { get; init; } = Algorithm;

    /// <summary>Signing key ID (signing_keys.id).</summary>
    public required Guid Kid { get; init; }

    /// <summary>Token type identifier.</summary>
    public string Typ { get; init; } = TokenType;

    /// <summary>Token format version.</summary>
    public int Ver { get; init; } = Version;
}
