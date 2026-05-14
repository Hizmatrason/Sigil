using Sigil.Domain.Entities;

namespace Sigil.Application.Interfaces;

public interface ICompanyRepository
{
    Task<Company?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Company>> GetByParentAsync(Guid? parentId, CancellationToken ct = default);
    Task<IReadOnlyList<Company>> GetSubtreeAsync(Guid rootId, CancellationToken ct = default);
    Task<IReadOnlyList<Company>> GetAllAsync(CancellationToken ct = default);
    Task AddAsync(Company company, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
