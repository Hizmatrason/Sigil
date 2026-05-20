using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface IActivationRepository
{
    Task<Activation?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Activation?> GetActiveByLicenseAndHwFpAsync(Guid licenseId, string? hwFingerprint, CancellationToken ct = default);
    Task<IReadOnlyList<Activation>> GetByLicenseAsync(Guid licenseId, CancellationToken ct = default);
    Task AddAsync(Activation activation, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
