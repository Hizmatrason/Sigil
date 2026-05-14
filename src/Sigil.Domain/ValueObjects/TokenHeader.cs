namespace Sigil.Domain.ValueObjects;

public sealed class TokenHeader
{
    public string Alg { get; init; } = "Ed25519";
    public Guid Kid { get; init; }
    public string Typ { get; init; } = "sigil-license";
    public int Ver { get; init; } = 1;

    public TokenHeader(Guid kid)
    {
        Kid = kid;
    }
}
