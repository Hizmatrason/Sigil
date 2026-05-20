using Sigil.Domain.Common;
using Sigil.Domain.Enums;

namespace Sigil.Domain.Entities;

/// <summary>
/// A record of a license being activated on a specific machine.
/// One license may have multiple activations (if the template allows it).
/// </summary>
public sealed class Activation : BaseEntity
{
    public Guid LicenseId { get; set; }
    public License License { get; set; } = null!;

    public string? HwFingerprint { get; set; }
    public string? MachineName { get; set; }
    public string? ClientIp { get; set; }

    public ActivationStatus Status { get; set; } = ActivationStatus.Active;

    public DateTimeOffset ActivatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? DeactivatedAt { get; set; }
    public DateTimeOffset? LastHeartbeatAt { get; set; }

    public ICollection<Heartbeat> Heartbeats { get; set; } = [];
}
