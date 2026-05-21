using Sigil.Domain.Common;

namespace Sigil.Domain.Entities;

/// <summary>
/// Immutable record of a significant action performed in the system.
/// CreatedAt (from BaseEntity) = timestamp of the event.
/// </summary>
public sealed class AuditLog : BaseEntity
{
    public string Action { get; set; } = null!;       // e.g. "license.issued"
    public string? ActorEmail { get; set; }           // null for system/client actions
    public string EntityType { get; set; } = null!;   // "License", "Template", "Company", "SigningKey"
    public Guid? EntityId { get; set; }
    public string? Meta { get; set; }                 // JSON — reason, key ids, etc.
    public string? IpAddress { get; set; }
}
