using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class LicenseRepository : ILicenseRepository
{
    private readonly SigilDbContext _db;

    public LicenseRepository(SigilDbContext db) => _db = db;

    public Task<License?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.Licenses.AsNoTracking()
            .Include(l => l.Versions)
            .FirstOrDefaultAsync(l => l.Id == id, ct);

    public Task<License?> GetByLicenseKeyAsync(string licenseKey, CancellationToken ct = default)
        => _db.Licenses.AsNoTracking()
            .FirstOrDefaultAsync(l => l.LicenseKey == licenseKey, ct);

    public Task<IReadOnlyList<License>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default)
        => _db.Licenses.AsNoTracking()
            .Where(l => l.CompanyId == companyId)
            .OrderByDescending(l => l.IssuedAt)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<License>)t.Result, ct);

    public Task<IReadOnlyList<License>> GetByTemplateAsync(Guid templateId, CancellationToken ct = default)
        => _db.Licenses.AsNoTracking()
            .Where(l => l.TemplateId == templateId)
            .OrderByDescending(l => l.IssuedAt)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<License>)t.Result, ct);

    public Task<IReadOnlyList<License>> GetAllAsync(CancellationToken ct = default)
        => _db.Licenses.AsNoTracking()
            .OrderByDescending(l => l.IssuedAt)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<License>)t.Result, ct);

    public async Task AddAsync(License license, CancellationToken ct = default)
    {
        await _db.Licenses.AddAsync(license, ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
