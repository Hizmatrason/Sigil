namespace Sigil.Application.Dtos;

public sealed record CompanyCreateRequest(
    string Name,
    string Slug,
    Guid? ParentId,
    string? ContactEmail);

public sealed record CompanyUpdateRequest(
    string? Name,
    string? Slug,
    string? ContactEmail,
    string? Status);

public sealed record CompanyResponse(
    Guid Id,
    string Name,
    string Slug,
    Guid? ParentId,
    string Path,
    int Depth,
    string Status,
    string? ContactEmail,
    DateTimeOffset CreatedAt);
