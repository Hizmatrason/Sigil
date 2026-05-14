using Sigil.Domain.Common;

namespace Sigil.Domain.Entities;

/// <summary>
/// User — can be an operator (Sigil staff) or a tenant admin.
/// </summary>
public sealed class User : BaseEntity
{
    public string Email { get; set; } = null!;
    public string? PasswordHash { get; set; }
    public string? DisplayName { get; set; }
    public bool IsOperator { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastLoginAt { get; set; }

    public ICollection<RoleAssignment> RoleAssignments { get; set; } = [];
}
