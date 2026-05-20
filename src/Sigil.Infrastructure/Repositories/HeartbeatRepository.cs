using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class HeartbeatRepository : IHeartbeatRepository
{
    private readonly SigilDbContext _db;

    public HeartbeatRepository(SigilDbContext db) => _db = db;

    public Task<IReadOnlyList<Heartbeat>> GetByLicenseAsync(Guid licenseId, int limit = 100, CancellationToken ct = default)
        => _db.Heartbeats.AsNoTracking()
            .Where(h => h.LicenseId == licenseId)
            .OrderByDescending(h => h.CreatedAt)
            .Take(limit)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<Heartbeat>)t.Result, ct);

    public async Task AddAsync(Heartbeat heartbeat, CancellationToken ct = default)
        => await _db.Heartbeats.AddAsync(heartbeat, ct);

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
