namespace Sigil.Application.Dtos;

public sealed record LicenseTemplateCreateRequest(
    string Name,
    string ProductCode,
    string? Description,
    int DefaultOfflineDays,
    int DefaultValidityDays);

public sealed record LicenseTemplateUpdateRequest(
    string? Name,
    string? ProductCode,
    string? Description,
    int? DefaultOfflineDays,
    int? DefaultValidityDays);

public sealed record LicenseTemplateResponse(
    Guid Id,
    string Name,
    string ProductCode,
    string? Description,
    int DefaultOfflineDays,
    int DefaultValidityDays,
    string Status,
    Guid? CurrentVersionId,
    DateTimeOffset CreatedAt);

public sealed record CreateTemplateVersionRequest(
    string ConfigSchema,
    string? Defaults = null,
    string? Changelog = null);

public sealed record TemplateVersionResponse(
    Guid Id,
    Guid TemplateId,
    int Version,
    string ConfigSchema,
    string Defaults,
    Guid SigningKeyId,
    string? Changelog,
    DateTimeOffset CreatedAt);

public sealed record SigningKeyDto(
    Guid Id,
    string Status,
    DateTimeOffset NotBefore,
    DateTimeOffset? NotAfter,
    DateTimeOffset CreatedAt,
    string PublicKeyHex);
