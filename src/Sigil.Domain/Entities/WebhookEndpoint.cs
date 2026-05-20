using Sigil.Domain.Common;

namespace Sigil.Domain.Entities;

/// <summary>
/// A registered HTTP endpoint that receives webhook event deliveries.
/// </summary>
public sealed class WebhookEndpoint : BaseEntity
{
    public string Url { get; set; } = null!;
    public string Secret { get; set; } = null!;     // HMAC-SHA256 signing secret
    public string Description { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public string[] Events { get; set; } = [];      // subscribed event types

    public DateTimeOffset? LastDeliveryAt { get; set; }

    public ICollection<WebhookDelivery> Deliveries { get; set; } = [];
}
