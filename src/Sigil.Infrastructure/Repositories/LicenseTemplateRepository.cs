using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class LicenseTemplateRepository : ILicenseTemplateRepository
{
    private readonly SigilDbContext _db;

    public LicenseTemplateRepository(SigilDbContext db) => _db = db;

    public Task<LicenseTemplate?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.LicenseTemplates
            .Include(t => t.SigningKeys)
            .FirstOrDefaultAsync(t => t.Id == id, ct);

    public Task<IReadOnlyList<LicenseTemplate>> GetAllAsync(CancellationToken ct = default)
        => _db.LicenseTemplates.AsNoTracking()
            .OrderBy(t => t.Name)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<LicenseTemplate>)t.Result, ct);

    public Task<TemplateVersion?> GetVersionAsync(Guid templateId, int version, CancellationToken ct = default)
        => _db.TemplateVersions.AsNoTracking()
            .FirstOrDefaultAsync(v => v.TemplateId == templateId && v.Version == version, ct);

    public Task<IReadOnlyList<TemplateVersion>> GetVersionsAsync(Guid templateId, CancellationToken ct = default)
        => _db.TemplateVersions.AsNoTracking()
            .Where(v => v.TemplateId == templateId)
            .OrderByDescending(v => v.Version)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<TemplateVersion>)t.Result, ct);

    public async Task AddAsync(LicenseTemplate entity, CancellationToken ct = default)
        => await _db.LicenseTemplates.AddAsync(entity, ct);

    public async Task AddVersionAsync(TemplateVersion version, CancellationToken ct = default)
        => await _db.TemplateVersions.AddAsync(version, ct);

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
