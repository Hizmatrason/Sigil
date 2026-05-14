namespace Sigil.Domain.Entities;

/// <summary>
/// Role definition (owner / admin / billing / viewer).
/// </summary>
public sealed class Role
{
    public int Id { get; set; }
    public string Code { get; set; } = null!; // owner / admin / billing / viewer

    public ICollection<RoleAssignment> RoleAssignments { get; set; } = [];
}
