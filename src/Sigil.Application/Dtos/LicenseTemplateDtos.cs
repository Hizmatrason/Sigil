namespace Sigil.Application.Dtos;

public sealed record LicenseTemplateCreateRequest(
    Guid CompanyId,
    string Name,
    string ProductCode,
    string? Description,
    int DefaultOfflineDays,
    int DefaultValidityDays);

public sealed record LicenseTemplateResponse(
    Guid Id,
    Guid CompanyId,
    string Name,
    string ProductCode,
    string? Description,
    int DefaultOfflineDays,
    int DefaultValidityDays,
    string Status,
    DateTimeOffset CreatedAt);
