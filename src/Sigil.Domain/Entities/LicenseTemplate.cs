using Sigil.Domain.Common;
using Sigil.Domain.Enums;

namespace Sigil.Domain.Entities;

/// <summary>
/// Reusable license template. Defines a product, JSON Schema for config,
/// default offline/validity settings.
/// </summary>
public sealed class LicenseTemplate : BaseEntity
{
    public string Name { get; set; } = null!;
    public string ProductCode { get; set; } = null!;
    public string? Description { get; set; }
    public int DefaultOfflineDays { get; set; } = 30;
    public int DefaultValidityDays { get; set; } = 365;
    public TemplateStatus Status { get; set; } = TemplateStatus.Draft;
    public Guid? CurrentVersionId { get; set; }

    public ICollection<TemplateVersion> Versions { get; set; } = [];
    public ICollection<SigningKey> SigningKeys { get; set; } = [];
    public ICollection<License> Licenses { get; set; } = [];
}
