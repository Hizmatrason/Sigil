namespace Sigil.Domain.Entities;

/// <summary>
/// Assignment of a role to a user within a company subtree.
/// </summary>
public sealed class RoleAssignment
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public int RoleId { get; set; }
    public Role Role { get; set; } = null!;
    public DateTimeOffset GrantedAt { get; set; } = DateTimeOffset.UtcNow;
    public Guid? GrantedBy { get; set; }
}
