using Sigil.Domain.Common;

namespace Sigil.Domain.Entities;

/// <summary>
/// Versioned template configuration. Each change creates a new version.
/// Existing licenses stay on their version until explicitly migrated.
/// </summary>
public sealed class TemplateVersion : BaseEntity
{
    public Guid TemplateId { get; set; }
    public LicenseTemplate Template { get; set; } = null!;

    public int Version { get; set; }
    public string ConfigSchema { get; set; } = "{}"; // JSON Schema
    public string Defaults { get; set; } = "{}"; // JSON defaults
    public Guid SigningKeyId { get; set; }
    public SigningKey SigningKey { get; set; } = null!;
    public string? Changelog { get; set; }
    public Guid? CreatedBy { get; set; }

    public ICollection<License> Licenses { get; set; } = [];
}
