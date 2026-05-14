namespace Sigil.Application.Dtos;

public sealed record LicenseCreateRequest(
    Guid CompanyId,
    Guid TemplateId,
    string Config,
    DateTimeOffset? ExpiresAt,
    int? OfflineDays,
    string? HwFingerprint);

public sealed record LicenseResponse(
    Guid Id,
    string LicenseKey,
    Guid CompanyId,
    Guid TemplateId,
    string Status,
    string Config,
    DateTimeOffset? ExpiresAt,
    DateTimeOffset IssuedAt,
    DateTimeOffset? ActivatedAt,
    DateTimeOffset? LastHeartbeatAt);

public sealed record LicenseTokenResponse(
    string LicenseKey,
    string Token,
    string PublicKey);

public sealed record LicenseRevokeRequest(
    string? Reason);

public sealed record LicenseDownloadDto(
    string LicenseKey,
    string Token,
    string PublicKey);
