using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class WebhookDeliveryRepository : IWebhookDeliveryRepository
{
    private readonly SigilDbContext _db;

    public WebhookDeliveryRepository(SigilDbContext db) => _db = db;

    public Task<WebhookDelivery?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.WebhookDeliveries.FirstOrDefaultAsync(d => d.Id == id, ct);

    public Task<IReadOnlyList<WebhookDelivery>> GetByEndpointAsync(Guid endpointId, int limit = 50, CancellationToken ct = default)
        => _db.WebhookDeliveries.AsNoTracking()
            .Where(d => d.EndpointId == endpointId)
            .OrderByDescending(d => d.CreatedAt)
            .Take(limit)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<WebhookDelivery>)t.Result, ct);

    public Task<IReadOnlyList<WebhookDelivery>> GetDueAsync(int batchSize = 50, CancellationToken ct = default)
        => _db.WebhookDeliveries
            .Where(d => d.Status == WebhookDeliveryStatus.Pending
                     && d.NextAttemptAt <= DateTimeOffset.UtcNow)
            .OrderBy(d => d.NextAttemptAt)
            .Take(batchSize)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<WebhookDelivery>)t.Result, ct);

    public async Task AddAsync(WebhookDelivery delivery, CancellationToken ct = default)
        => await _db.WebhookDeliveries.AddAsync(delivery, ct);

    public async Task AddRangeAsync(IEnumerable<WebhookDelivery> deliveries, CancellationToken ct = default)
        => await _db.WebhookDeliveries.AddRangeAsync(deliveries, ct);

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
