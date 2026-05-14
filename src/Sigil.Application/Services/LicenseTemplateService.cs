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

    public async Task<LicenseTemplateResponse?> UpdateAsync(Guid id, LicenseTemplateUpdateRequest req, CancellationToken ct = default)
    {
        var template = await _repo.GetByIdAsync(id, ct);
        if (template is null) return null;

        if (req.Name is not null) template.Name = req.Name;
        if (req.ProductCode is not null) template.ProductCode = req.ProductCode;
        if (req.Description is not null) template.Description = req.Description;
        if (req.DefaultOfflineDays.HasValue) template.DefaultOfflineDays = req.DefaultOfflineDays.Value;
        if (req.DefaultValidityDays.HasValue) template.DefaultValidityDays = req.DefaultValidityDays.Value;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        await _repo.SaveChangesAsync(ct);
        return Map(template);
    }

    public async Task<bool> DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _repo.GetByIdAsync(id, ct);
        if (template is null) return false;

        template.Status = TemplateStatus.Archived;
        template.UpdatedAt = DateTimeOffset.UtcNow;
        await _repo.SaveChangesAsync(ct);
        return true;
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

    public async Task<IReadOnlyList<LicenseTemplateResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await _repo.GetAllAsync(ct);
        return list.Select(Map).ToList();
    }

    // ── Versions ──────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<TemplateVersionResponse>> GetVersionsAsync(Guid templateId, CancellationToken ct = default)
    {
        var versions = await _repo.GetVersionsAsync(templateId, ct);
        return versions.Select(MapVersion).ToList();
    }

    public async Task<TemplateVersionResponse> CreateVersionAsync(Guid templateId, CreateTemplateVersionRequest req, CancellationToken ct = default)
    {
        var template = await _repo.GetByIdAsync(templateId, ct)
            ?? throw new InvalidOperationException("Template not found");

        var signingKey = template.SigningKeys.FirstOrDefault(k => k.Status == SigningKeyStatus.Active)
            ?? throw new InvalidOperationException("No active signing key for template");

        var existingVersions = await _repo.GetVersionsAsync(templateId, ct);
        var nextVersion = existingVersions.Count == 0 ? 1 : existingVersions.Max(v => v.Version) + 1;

        var version = new TemplateVersion
        {
            Id = Guid.NewGuid(),
            TemplateId = templateId,
            Version = nextVersion,
            ConfigSchema = req.ConfigSchema,
            Defaults = req.Defaults,
            SigningKeyId = signingKey.Id,
            Changelog = req.Changelog,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        template.CurrentVersionId = version.Id;
        await _repo.AddVersionAsync(version, ct);
        await _repo.SaveChangesAsync(ct);

        return MapVersion(version);
    }

    private static LicenseTemplateResponse Map(LicenseTemplate t)
        => new(t.Id, t.CompanyId, t.Name, t.ProductCode, t.Description,
               t.DefaultOfflineDays, t.DefaultValidityDays, t.Status.ToString(),
               t.CurrentVersionId, t.CreatedAt);

    private static TemplateVersionResponse MapVersion(TemplateVersion v)
        => new(v.Id, v.TemplateId, v.Version, v.ConfigSchema, v.Defaults,
               v.SigningKeyId, v.Changelog, v.CreatedAt);
}
