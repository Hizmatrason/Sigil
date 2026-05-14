using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;

namespace Sigil.Application.Services;

public sealed class LicenseTemplateService
{
    private readonly ILicenseTemplateRepository _repo;

    public LicenseTemplateService(ILicenseTemplateRepository repo) => _repo = repo;

    public async Task<LicenseTemplateResponse> CreateAsync(LicenseTemplateCreateRequest req, CancellationToken ct = default)
    {
        var template = new LicenseTemplate
        {
            Id = Guid.NewGuid(),
            CompanyId = req.CompanyId,
            Name = req.Name,
            ProductCode = req.ProductCode,
            Description = req.Description,
            DefaultOfflineDays = req.DefaultOfflineDays,
            DefaultValidityDays = req.DefaultValidityDays,
            Status = TemplateStatus.Active,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        await _repo.AddAsync(template, ct);
        await _repo.SaveChangesAsync(ct);

        return Map(template);
    }

    public async Task<LicenseTemplateResponse?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _repo.GetByIdAsync(id, ct);
        return template is null ? null : Map(template);
    }

    public async Task<IReadOnlyList<LicenseTemplateResponse>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default)
    {
        var list = await _repo.GetByCompanyAsync(companyId, ct);
        return list.Select(Map).ToList();
    }

    private static LicenseTemplateResponse Map(LicenseTemplate t)
        => new(t.Id, t.CompanyId, t.Name, t.ProductCode, t.Description,
               t.DefaultOfflineDays, t.DefaultValidityDays, t.Status.ToString(), t.CreatedAt);
}
