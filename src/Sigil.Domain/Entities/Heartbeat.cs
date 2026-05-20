using Sigil.Domain.Common;

namespace Sigil.Domain.Entities;

/// <summary>
/// A single heartbeat check-in from a licensed client.
/// </summary>
public sealed class Heartbeat : BaseEntity
{
    public Guid LicenseId { get; set; }
    public License License { get; set; } = null!;

    public Guid ActivationId { get; set; }
    public Activation Activation { get; set; } = null!;

    public string? HwFingerprint { get; set; }
    public string? ClientIp { get; set; }
}
