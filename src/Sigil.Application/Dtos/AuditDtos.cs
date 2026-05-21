namespace Sigil.Application.Dtos;

public sealed record AuditLogDto(
    Guid Id,
    string Action,
    string? ActorEmail,
    string EntityType,
    Guid? EntityId,
    string? Meta,
    string? IpAddress,
    DateTimeOffset OccurredAt);
