using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface IHeartbeatRepository
{
    Task<IReadOnlyList<Heartbeat>> GetByLicenseAsync(Guid licenseId, int limit = 100, CancellationToken ct = default);
    Task AddAsync(Heartbeat heartbeat, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
