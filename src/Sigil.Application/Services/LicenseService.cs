using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;
using Sigil.Domain.ValueObjects;

namespace Sigil.Application.Services;

public sealed class LicenseService
{
    private readonly ILicenseRepository _licenseRepo;
    private readonly ILicenseTemplateRepository _templateRepo;
    private readonly ICompanyRepository _companyRepo;
    private readonly ISigner _signer;

    public LicenseService(
        ILicenseRepository licenseRepo,
        ILicenseTemplateRepository templateRepo,
        ICompanyRepository companyRepo,
        ISigner signer)
    {
        _licenseRepo = licenseRepo;
        _templateRepo = templateRepo;
        _companyRepo = companyRepo;
        _signer = signer;
    }

    public async Task<LicenseTokenResponse> IssueAsync(LicenseCreateRequest req, CancellationToken ct = default)
    {
        var template = await _templateRepo.GetByIdAsync(req.TemplateId, ct)
            ?? throw new InvalidOperationException("Template not found");

        var company = await _companyRepo.GetByIdAsync(req.CompanyId, ct)
            ?? throw new InvalidOperationException("Company not found");

        // Get active signing key for template
        var signingKey = template.SigningKeys.FirstOrDefault(k => k.Status == SigningKeyStatus.Active)
            ?? throw new InvalidOperationException("No active signing key for template");

        var licenseKey = GenerateLicenseKey();
        var now = DateTime.UtcNow;
        var expiresAt = req.ExpiresAt ?? now.AddDays(template.DefaultValidityDays);
        var offlineDays = req.OfflineDays ?? template.DefaultOfflineDays;

        var license = new License
        {
            Id = Guid.NewGuid(),
            CompanyId = req.CompanyId,
            TemplateId = req.TemplateId,
            TemplateVersionId = template.CurrentVersionId ?? template.Id,
            LicenseKey = licenseKey,
            Status = LicenseStatus.Active,
            Config = req.Config,
            HwFingerprint = req.HwFingerprint,
            OfflineDays = offlineDays,
            IssuedAt = now,
            ExpiresAt = expiresAt,
            CurrentVersion = 1,
            CreatedAt = now,
            UpdatedAt = now,
            RevokedAt = null,
        };

        await _licenseRepo.AddAsync(license, ct);

        // Build and sign token payload
        var payload = new LicenseTokenPayload
        {
            LicenseId = license.Id,
            LicenseKey = licenseKey,
            TemplateId = template.Id,
            CompanyId = company.Id,
            ExpiresAt = expiresAt.DateTime,
            MaxOfflineDays = offlineDays,
            HwFingerprint = req.HwFingerprint,
            Config = System.Text.Json.JsonDocument.Parse(req.Config),
        };

        var token = await BuildAndSignTokenAsync(payload, signingKey, ct);

        // Save license version with token
        var version = new LicenseVersion
        {
            Id = Guid.NewGuid(),
            LicenseId = license.Id,
            Version = 1,
            Config = req.Config,
            SignedToken = token,
            SignedAt = now,
        };

        license.Versions.Add(version);
        await _licenseRepo.SaveChangesAsync(ct);

        var publicKey = await _signer.GetPublicKeyAsync(signingKey.Id, ct);
        var publicKeyHex = Convert.ToHexString(publicKey).ToLowerInvariant();

        return new LicenseTokenResponse(licenseKey, token, publicKeyHex);
    }

    public async Task<LicenseResponse?> GetAsync(Guid id, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByIdAsync(id, ct);
        return license is null ? null : Map(license);
    }

    public async Task<IReadOnlyList<LicenseResponse>> GetByCompanyAsync(Guid companyId, CancellationToken ct = default)
    {
        var list = await _licenseRepo.GetByCompanyAsync(companyId, ct);
        return list.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<LicenseResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var list = await _licenseRepo.GetAllAsync(ct);
        return list.Select(Map).ToList();
    }

    public async Task<bool> RevokeAsync(Guid id, string? reason, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByIdAsync(id, ct);
        if (license is null) return false;

        license.Status = LicenseStatus.Revoked;
        license.RevokedAt = DateTimeOffset.UtcNow;
        license.RevocationReason = reason;
        license.UpdatedAt = DateTimeOffset.UtcNow;
        await _licenseRepo.SaveChangesAsync(ct);
        return true;
    }

    public async Task<LicenseDownloadDto?> GetDownloadAsync(Guid id, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByIdAsync(id, ct);
        if (license is null) return null;

        var template = await _templateRepo.GetByIdAsync(license.TemplateId, ct);
        if (template is null) return null;

        var signingKey = template.SigningKeys.FirstOrDefault(k => k.Status == SigningKeyStatus.Active);
        if (signingKey is null) return null;

        var latestVersion = license.Versions.OrderByDescending(v => v.Version).FirstOrDefault();
        if (latestVersion is null) return null;

        var publicKey = await _signer.GetPublicKeyAsync(signingKey.Id, ct);
        var publicKeyHex = Convert.ToHexString(publicKey).ToLowerInvariant();

        return new LicenseDownloadDto(license.LicenseKey, latestVersion.SignedToken, publicKeyHex);
    }

    public async Task<string?> GetPublicKeyAsync(Guid licenseId, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByIdAsync(licenseId, ct);
        if (license is null) return null;

        var template = await _templateRepo.GetByIdAsync(license.TemplateId, ct);
        if (template is null) return null;

        var signingKey = template.SigningKeys.FirstOrDefault(k => k.Status == SigningKeyStatus.Active);
        if (signingKey is null) return null;

        var publicKey = await _signer.GetPublicKeyAsync(signingKey.Id, ct);
        return Convert.ToHexString(publicKey).ToLowerInvariant();
    }

    private static string GenerateLicenseKey()
    {
        var bytes = RandomNumberGenerator.GetBytes(8);
        var sb = new StringBuilder("SGIL-");
        sb.Append(Convert.ToHexString(bytes[..4])[..4]).Append('-');
        sb.Append(Convert.ToHexString(bytes[4..6])[..4]).Append('-');
        sb.Append(Convert.ToHexString(bytes[6..])[..4]);
        return sb.ToString().ToUpperInvariant();
    }

    private async Task<string> BuildAndSignTokenAsync(
        LicenseTokenPayload payload, SigningKey signingKey, CancellationToken ct)
    {
        var header = new TokenHeader(signingKey.Id);

        var payloadBytes = JsonSerializer.SerializeToUtf8Bytes(payload);
        var headerBytes = JsonSerializer.SerializeToUtf8Bytes(header);

        var headerB64 = Base64UrlEncode(headerBytes);
        var payloadB64 = Base64UrlEncode(payloadBytes);
        var message = Encoding.UTF8.GetBytes(headerB64 + "." + payloadB64);

        var signature = await _signer.SignAsync(signingKey.Id, message, ct);
        var sigB64 = Base64UrlEncode(signature);

        return $"sigil1.{headerB64}.{payloadB64}.{sigB64}";
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        var base64 = Convert.ToBase64String(bytes);
        return base64.Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static LicenseResponse Map(License l)
        => new(l.Id, l.LicenseKey, l.CompanyId, l.TemplateId, l.Status.ToString(), l.Config,
               l.ExpiresAt, l.IssuedAt, l.ActivatedAt, l.LastHeartbeatAt);
}
