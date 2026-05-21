using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class AuditLogRepository : IAuditLogRepository
{
    private readonly SigilDbContext _db;

    public AuditLogRepository(SigilDbContext db) => _db = db;

    public async Task AddAsync(AuditLog entry, CancellationToken ct = default)
        => await _db.AuditLogs.AddAsync(entry, ct);

    public async Task<IReadOnlyList<AuditLog>> QueryAsync(
        string? action,
        string? actorEmail,
        string? entityType,
        Guid? entityId,
        DateTimeOffset? from,
        DateTimeOffset? until,
        int limit,
        int offset,
        CancellationToken ct = default)
    {
        var q = _db.AuditLogs.AsNoTracking().AsQueryable();

        if (action is not null) q = q.Where(a => a.Action == action);
        if (actorEmail is not null) q = q.Where(a => a.ActorEmail == actorEmail);
        if (entityType is not null) q = q.Where(a => a.EntityType == entityType);
        if (entityId.HasValue) q = q.Where(a => a.EntityId == entityId);
        if (from.HasValue) q = q.Where(a => a.CreatedAt >= from.Value);
        if (until.HasValue) q = q.Where(a => a.CreatedAt <= until.Value);

        var list = await q
            .OrderByDescending(a => a.CreatedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(ct);

        return list;
    }

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
