using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;

namespace Sigil.Application.Services;

public sealed class CompanyService
{
    private readonly ICompanyRepository _repo;

    public CompanyService(ICompanyRepository repo) => _repo = repo;

    public async Task<CompanyResponse> CreateAsync(CompanyCreateRequest req, CancellationToken ct = default)
    {
        var company = new Company
        {
            Id = Guid.NewGuid(),
            Name = req.Name,
            Slug = req.Slug,
            ParentId = req.ParentId,
            Path = req.ParentId.HasValue ? "" : "root",
            Depth = req.ParentId.HasValue ? 1 : 0,
            Status = CompanyStatus.Active,
            ContactEmail = req.ContactEmail,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _repo.AddAsync(company, ct);
        await _repo.SaveChangesAsync(ct);

        return Map(company);
    }

    public async Task<CompanyResponse?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _repo.GetByIdAsync(id, ct);
        return company is null ? null : Map(company);
    }

    public async Task<IReadOnlyList<CompanyResponse>> GetChildrenAsync(Guid? parentId, CancellationToken ct = default)
    {
        var list = await _repo.GetByParentAsync(parentId, ct);
        return list.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<CompanyResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await _repo.GetAllAsync(ct);
        return list.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<CompanyResponse>> GetSubtreeAsync(Guid rootId, CancellationToken ct = default)
    {
        var list = await _repo.GetSubtreeAsync(rootId, ct);
        return list.Select(Map).ToList();
    }

    private static CompanyResponse Map(Company c)
        => new(c.Id, c.Name, c.Slug, c.ParentId, c.Path, c.Depth, c.Status.ToString(), c.ContactEmail, c.CreatedAt);

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var company = await _repo.GetByIdAsync(id, ct);
        if (company is null) return false;

        company.Status = CompanyStatus.Archived;
        company.UpdatedAt = DateTimeOffset.UtcNow;
        await _repo.SaveChangesAsync(ct);
        return true;
    }
}
