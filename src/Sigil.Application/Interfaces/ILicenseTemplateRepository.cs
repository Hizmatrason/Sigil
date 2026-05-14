using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface ILicenseTemplateRepository
{
    Task<LicenseTemplate?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<LicenseTemplate>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default);
    Task<IReadOnlyList<LicenseTemplate>> GetAllAsync(CancellationToken ct = default);
    Task<TemplateVersion?> GetVersionAsync(Guid templateId, int version, CancellationToken ct = default);
    Task<IReadOnlyList<TemplateVersion>> GetVersionsAsync(Guid templateId, CancellationToken ct = default);
    Task AddAsync(LicenseTemplate entity, CancellationToken ct = default);
    Task AddVersionAsync(TemplateVersion version, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
