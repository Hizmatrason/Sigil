using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface ILicenseRepository
{
    Task<License?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<License?> GetByLicenseKeyAsync(string licenseKey, CancellationToken ct = default);
    Task<IReadOnlyList<License>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default);
    Task<IReadOnlyList<License>> GetByTemplateAsync(Guid templateId, CancellationToken ct = default);
    Task AddAsync(License license, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
