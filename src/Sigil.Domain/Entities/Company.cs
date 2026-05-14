using Sigil.Domain.Common;
using Sigil.Domain.Enums;

namespace Sigil.Domain.Entities;

/// <summary>
/// Tenant company — a node in the customer hierarchy tree.
/// Uses materialized path (ltree) for efficient descendant queries.
/// </summary>
public sealed class Company : BaseEntity
{
    public Guid? ParentId { get; set; }
    public Company? Parent { get; set; }
    public ICollection<Company> Children { get; set; } = [];

    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string Path { get; set; } = null!; // ltree materialized path
    public int Depth { get; set; }
    public CompanyStatus Status { get; set; } = CompanyStatus.Active;
    public string? ContactEmail { get; set; }
    public string Metadata { get; set; } = "{}"; // JSON

    public ICollection<User> Users { get; set; } = [];
    public ICollection<License> Licenses { get; set; } = [];
}
