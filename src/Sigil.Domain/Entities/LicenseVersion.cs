using Sigil.Domain.Common;

namespace Sigil.Domain.Entities;

/// <summary>
/// Version history for a license config. Each config change creates a new version
/// with a signed token that the SDK can download.
/// </summary>
public sealed class LicenseVersion : BaseEntity
{
    public Guid LicenseId { get; set; }
    public License License { get; set; } = null!;

    public int Version { get; set; }
    public string Config { get; set; } = "{}"; // JSON config
    public string SignedToken { get; set; } = null!; // The sigil1.xxx.yyy.zzz token
    public DateTimeOffset SignedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? SignedBy { get; set; }
}
