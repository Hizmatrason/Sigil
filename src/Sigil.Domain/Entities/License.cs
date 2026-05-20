using Sigil.Domain.Common;
using Sigil.Domain.Enums;

namespace Sigil.Domain.Entities;

/// <summary>
/// An issued license instance bound to a template and company.
/// </summary>
public sealed class License : BaseEntity
{
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public Guid TemplateId { get; set; }
    public LicenseTemplate Template { get; set; } = null!;
    public Guid TemplateVersionId { get; set; }
    public TemplateVersion TemplateVersion { get; set; } = null!;

    public string LicenseKey { get; set; } = null!; // e.g. "SGIL-AB12-CD34-EF56"
    public LicenseStatus Status { get; set; } = LicenseStatus.Active;
    public string Config { get; set; } = "{}"; // JSON config values per schema
    public string? HwFingerprint { get; set; }
    public int OfflineDays { get; set; } = 30;
    public int CurrentVersion { get; set; } = 1;

    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ActivatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? LastHeartbeatAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public string? RevocationReason { get; set; }
    public Guid? CreatedBy { get; set; }

    public ICollection<LicenseVersion> Versions { get; set; } = [];
    public ICollection<Activation> Activations { get; set; } = [];
    public ICollection<Heartbeat> Heartbeats { get; set; } = [];
}
