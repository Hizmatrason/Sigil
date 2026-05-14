using Microsoft.EntityFrameworkCore;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Repositories;

public sealed class CompanyRepository : ICompanyRepository
{
    private readonly SigilDbContext _db;

    public CompanyRepository(SigilDbContext db) => _db = db;

    public Task<Company?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => _db.Companies.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<IReadOnlyList<Company>> GetByParentAsync(Guid? parentId, CancellationToken ct = default)
        => _db.Companies.AsNoTracking()
            .Where(c => c.ParentId == parentId)
            .OrderBy(c => c.Name)
            .ToListAsync(ct)
            .ContinueWith(t => (IReadOnlyList<Company>)t.Result, ct);

    public async Task<IReadOnlyList<Company>> GetSubtreeAsync(Guid rootId, CancellationToken ct = default)
    {
        var root = await _db.Companies.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == rootId, ct);

        if (root is null) return Array.Empty<Company>();

        // ltree path query: path <@ root.Path (descendants including self)
        var pathValue = root.Path;
        return await _db.Companies.AsNoTracking()
            .Where(c => EF.Functions.Like(c.Path, pathValue + ".%") || c.Id == rootId)
            .OrderBy(c => c.Path)
            .ToListAsync(ct);
    }

    public async Task AddAsync(Company company, CancellationToken ct = default)
    {
        await _db.Companies.AddAsync(company, ct);
    }

    public Task SaveChangesAsync(CancellationToken ct = default)
        => _db.SaveChangesAsync(ct);
}
