namespace Sigil.Domain.Webhooks;

public static class WebhookEventTypes
{
    public const string LicenseIssued           = "license.issued";
    public const string LicenseRevoked          = "license.revoked";
    public const string LicenseExpired          = "license.expired";
    public const string LicenseActivated        = "license.activated";
    public const string LicenseHeartbeatMissed  = "license.heartbeat_missed";

    public static readonly IReadOnlyList<string> All =
    [
        LicenseIssued,
        LicenseRevoked,
        LicenseExpired,
        LicenseActivated,
        LicenseHeartbeatMissed,
    ];
}
