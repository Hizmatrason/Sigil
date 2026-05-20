using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface IWebhookEndpointRepository
{
    Task<WebhookEndpoint?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<WebhookEndpoint>> GetAllAsync(CancellationToken ct = default);
    Task<IReadOnlyList<WebhookEndpoint>> GetActiveByEventAsync(string eventType, CancellationToken ct = default);
    Task AddAsync(WebhookEndpoint endpoint, CancellationToken ct = default);
    Task DeleteAsync(WebhookEndpoint endpoint, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
