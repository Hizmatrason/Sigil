using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class WebhookEndpointRepository : IWebhookEndpointRepository
{
    private readonly SigilDbContext _db;

    public WebhookEndpointRepository(SigilDbContext db) => _db = db;

    public Task<WebhookEndpoint?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.WebhookEndpoints.FirstOrDefaultAsync(e => e.Id == id, ct);

    public Task<IReadOnlyList<WebhookEndpoint>> GetAllAsync(CancellationToken ct = default)
        => _db.WebhookEndpoints.AsNoTracking()
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<WebhookEndpoint>)t.Result, ct);

    public Task<IReadOnlyList<WebhookEndpoint>> GetActiveByEventAsync(string eventType, CancellationToken ct = default)
        => _db.WebhookEndpoints.AsNoTracking()
            .Where(e => e.IsActive && e.Events.Contains(eventType))
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<WebhookEndpoint>)t.Result, ct);

    public async Task AddAsync(WebhookEndpoint endpoint, CancellationToken ct = default)
        => await _db.WebhookEndpoints.AddAsync(endpoint, ct);

    public Task DeleteAsync(WebhookEndpoint endpoint, CancellationToken ct = default)
    {
        _db.WebhookEndpoints.Remove(endpoint);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
