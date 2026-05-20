using Sigil.Domain.Common;
using Sigil.Domain.Enums;

namespace Sigil.Domain.Entities;

/// <summary>
/// A single delivery attempt record for a webhook event.
/// One event fan-out creates one WebhookDelivery per subscribed endpoint.
/// </summary>
public sealed class WebhookDelivery : BaseEntity
{
    public Guid EndpointId { get; set; }
    public WebhookEndpoint Endpoint { get; set; } = null!;

    public string EventType { get; set; } = null!;  // "license.issued" etc.
    public string Payload { get; set; } = null!;    // full JSON envelope (immutable)

    public WebhookDeliveryStatus Status { get; set; } = WebhookDeliveryStatus.Pending;
    public int AttemptCount { get; set; }

    public int? ResponseStatusCode { get; set; }
    public string? ResponseBody { get; set; }
    public string? LastError { get; set; }

    public DateTimeOffset? NextAttemptAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastAttemptAt { get; set; }
}
