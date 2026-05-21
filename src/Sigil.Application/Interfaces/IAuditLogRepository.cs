using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface IAuditLogRepository
{
    Task AddAsync(AuditLog entry, CancellationToken ct = default);
    Task<IReadOnlyList<AuditLog>> QueryAsync(
        string? action,
        string? actorEmail,
        string? entityType,
        Guid? entityId,
        DateTimeOffset? from,
        DateTimeOffset? until,
        int limit,
        int offset,
        CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
