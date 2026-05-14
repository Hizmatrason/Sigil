using Sigil.Domain.Common;
using Sigil.Domain.Enums;

namespace Sigil.Domain.Entities;

/// <summary>
/// Ed25519 signing key pair. Each template has its own key pair.
/// Private key is stored encrypted (file or Vault), never in the DB raw.
/// </summary>
public sealed class SigningKey : BaseEntity
{
    public Guid? TemplateId { get; set; }
    public LicenseTemplate? Template { get; set; }

    public byte[] PublicKey { get; set; } = null!; // 32 bytes Ed25519 public key
    public string PrivateKeyRef { get; set; } = null!; // path/reference to encrypted private key
    public string Algorithm { get; set; } = "ed25519";
    public SigningKeyStatus Status { get; set; } = SigningKeyStatus.Active;
    public DateTimeOffset NotBefore { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? NotAfter { get; set; }

    public ICollection<TemplateVersion> TemplateVersions { get; set; } = [];
}
