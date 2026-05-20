using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class ActivationRepository : IActivationRepository
{
    private readonly SigilDbContext _db;

    public ActivationRepository(SigilDbContext db) => _db = db;

    public Task<Activation?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.Activations.FirstOrDefaultAsync(a => a.Id == id, ct);

    public Task<Activation?> GetActiveByLicenseAndHwFpAsync(Guid licenseId, string? hwFingerprint, CancellationToken ct = default)
        => _db.Activations.FirstOrDefaultAsync(
            a => a.LicenseId == licenseId
              && a.Status == ActivationStatus.Active
              && a.HwFingerprint == hwFingerprint,
            ct);

    public Task<IReadOnlyList<Activation>> GetByLicenseAsync(Guid licenseId, CancellationToken ct = default)
        => _db.Activations.AsNoTracking()
            .Where(a => a.LicenseId == licenseId)
            .OrderByDescending(a => a.ActivatedAt)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<Activation>)t.Result, ct);

    public async Task AddAsync(Activation activation, CancellationToken ct = default)
        => await _db.Activations.AddAsync(activation, ct);

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
