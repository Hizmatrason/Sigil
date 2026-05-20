using Sigil.Domain.Entities;
using Sigil.Domain.Enums;

namespace Sigil.Application.Interfaces;

public interface IWebhookDeliveryRepository
{
    Task<WebhookDelivery?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<WebhookDelivery>> GetByEndpointAsync(Guid endpointId, int limit = 50, CancellationToken ct = default);

    /// <summary>Pending deliveries whose NextAttemptAt is in the past — for the dispatch worker.</summary>
    Task<IReadOnlyList<WebhookDelivery>> GetDueAsync(int batchSize = 50, CancellationToken ct = default);

    Task AddAsync(WebhookDelivery delivery, CancellationToken ct = default);
    Task AddRangeAsync(IEnumerable<WebhookDelivery> deliveries, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
