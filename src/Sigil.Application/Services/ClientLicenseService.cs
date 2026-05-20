using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Application.Licensing;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;
using Sigil.Domain.Webhooks;

namespace Sigil.Application.Services;

public sealed class ClientLicenseService
{
    private readonly ILicenseRepository _licenseRepo;
    private readonly ILicenseTemplateRepository _templateRepo;
    private readonly IActivationRepository _activationRepo;
    private readonly IHeartbeatRepository _heartbeatRepo;
    private readonly ISigner _signer;
    private readonly WebhookService _webhooks;

    private const int HeartbeatIntervalSeconds = 3600;

    public ClientLicenseService(
        ILicenseRepository licenseRepo,
        ILicenseTemplateRepository templateRepo,
        IActivationRepository activationRepo,
        IHeartbeatRepository heartbeatRepo,
        ISigner signer,
        WebhookService webhooks)
    {
        _licenseRepo = licenseRepo;
        _templateRepo = templateRepo;
        _activationRepo = activationRepo;
        _heartbeatRepo = heartbeatRepo;
        _signer = signer;
        _webhooks = webhooks;
    }

    public async Task<ActivateResponse> ActivateAsync(ActivateRequest req, string? clientIp, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByLicenseKeyAsync(req.LicenseKey, ct)
            ?? throw new InvalidOperationException("License not found");

        if (license.Status != LicenseStatus.Active)
            throw new InvalidOperationException($"License is {license.Status}");

        if (DateTimeOffset.UtcNow > license.ExpiresAt)
            throw new InvalidOperationException("License has expired");

        // Reuse existing active activation for the same machine
        var existing = await _activationRepo.GetActiveByLicenseAndHwFpAsync(license.Id, req.HwFingerprint, ct);
        if (existing is null)
        {
            existing = new Activation
            {
                Id = Guid.NewGuid(),
                LicenseId = license.Id,
                HwFingerprint = req.HwFingerprint,
                MachineName = req.MachineName,
                ClientIp = clientIp,
                Status = ActivationStatus.Active,
                ActivatedAt = DateTimeOffset.UtcNow,
            };
            await _activationRepo.AddAsync(existing, ct);
        }

        // Record that the license has been activated
        if (license.ActivatedAt is null)
        {
            // Need tracked instance — re-fetch via tracked GetByIdAsync
        }

        var token = await IssueMarkerAsync(license, req.HwFingerprint, ct);
        await _activationRepo.SaveChangesAsync(ct);

        _ = _webhooks.PublishEventAsync(WebhookEventTypes.LicenseActivated, new
        {
            licenseId = license.Id,
            activationId = existing.Id,
            hwFingerprint = req.HwFingerprint,
            machineName = req.MachineName,
            clientIp,
        }, ct);

        return new ActivateResponse(
            existing.Id,
            token,
            HeartbeatIntervalSeconds,
            license.OfflineDays);
    }

    public async Task<HeartbeatResponse> HeartbeatAsync(HeartbeatRequest req, string? clientIp, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByLicenseKeyAsync(req.LicenseKey, ct)
            ?? throw new InvalidOperationException("License not found");

        if (license.Status != LicenseStatus.Active)
            throw new InvalidOperationException($"License is {license.Status}");

        if (DateTimeOffset.UtcNow > license.ExpiresAt)
            throw new InvalidOperationException("License has expired");

        var activation = await _activationRepo.GetByIdAsync(req.ActivationId, ct)
            ?? throw new InvalidOperationException("Activation not found");

        if (activation.LicenseId != license.Id)
            throw new InvalidOperationException("Activation does not belong to this license");

        if (activation.Status != ActivationStatus.Active)
            throw new InvalidOperationException("Activation is no longer active");

        var now = DateTimeOffset.UtcNow;
        activation.LastHeartbeatAt = now;
        activation.UpdatedAt = now;

        var heartbeat = new Heartbeat
        {
            Id = Guid.NewGuid(),
            LicenseId = license.Id,
            ActivationId = activation.Id,
            HwFingerprint = activation.HwFingerprint,
            ClientIp = clientIp,
            CreatedAt = now,
        };
        await _heartbeatRepo.AddAsync(heartbeat, ct);

        var token = await IssueMarkerAsync(license, activation.HwFingerprint, ct);
        await _activationRepo.SaveChangesAsync(ct);
        await _heartbeatRepo.SaveChangesAsync(ct);

        return new HeartbeatResponse(token);
    }

    public async Task DeactivateAsync(DeactivateRequest req, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByLicenseKeyAsync(req.LicenseKey, ct)
            ?? throw new InvalidOperationException("License not found");

        var activation = await _activationRepo.GetByIdAsync(req.ActivationId, ct)
            ?? throw new InvalidOperationException("Activation not found");

        if (activation.LicenseId != license.Id)
            throw new InvalidOperationException("Activation does not belong to this license");

        var now = DateTimeOffset.UtcNow;
        activation.Status = ActivationStatus.Deactivated;
        activation.DeactivatedAt = now;
        activation.UpdatedAt = now;

        await _activationRepo.SaveChangesAsync(ct);
    }

    public async Task<ClientPublicKeyResponse?> GetPublicKeyAsync(string licenseKey, CancellationToken ct = default)
    {
        var license = await _licenseRepo.GetByLicenseKeyAsync(licenseKey, ct);
        if (license is null) return null;

        var template = await _templateRepo.GetByIdAsync(license.TemplateId, ct);
        if (template is null) return null;

        var signingKey = template.SigningKeys.FirstOrDefault(k => k.Status == SigningKeyStatus.Active);
        if (signingKey is null) return null;

        var publicKey = await _signer.GetPublicKeyAsync(signingKey.Id, ct);
        return new ClientPublicKeyResponse(Convert.ToHexString(publicKey).ToLowerInvariant());
    }

    public async Task<IReadOnlyList<ActivationDto>> GetActivationsAsync(Guid licenseId, CancellationToken ct = default)
    {
        var activations = await _activationRepo.GetByLicenseAsync(licenseId, ct);
        return activations.Select(a => new ActivationDto(
            a.Id,
            a.HwFingerprint,
            a.MachineName,
            a.Status.ToString(),
            a.ActivatedAt,
            a.LastHeartbeatAt,
            a.DeactivatedAt)).ToList();
    }

    public async Task<IReadOnlyList<HeartbeatDto>> GetHeartbeatsAsync(Guid licenseId, CancellationToken ct = default)
    {
        var heartbeats = await _heartbeatRepo.GetByLicenseAsync(licenseId, 200, ct);
        return heartbeats.Select(h => new HeartbeatDto(h.Id, h.ActivationId, h.CreatedAt)).ToList();
    }

    private async Task<string> IssueMarkerAsync(Domain.Entities.License license, string? hwFingerprint, CancellationToken ct)
    {
        var template = await _templateRepo.GetByIdAsync(license.TemplateId, ct)
            ?? throw new InvalidOperationException("Template not found");

        var signingKey = template.SigningKeys.FirstOrDefault(k => k.Status == SigningKeyStatus.Active)
            ?? throw new InvalidOperationException("No active signing key");

        return await HeartbeatMarker.IssueAsync(
            license.Id,
            license.LicenseKey,
            hwFingerprint,
            license.OfflineDays,
            msg => _signer.SignAsync(signingKey.Id, msg, ct));
    }
}
