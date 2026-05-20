namespace Sigil.Application.Dtos;

// ── Activate ──────────────────────────────────────────────────────────────────

public sealed record ActivateRequest(
    string LicenseKey,
    string? HwFingerprint,
    string? MachineName);

public sealed record ActivateResponse(
    Guid ActivationId,
    string HeartbeatToken,      // signed sigil1-hb marker, valid for MaxOfflineDays
    int HeartbeatIntervalSeconds,
    int MaxOfflineDays);

// ── Heartbeat ─────────────────────────────────────────────────────────────────

public sealed record HeartbeatRequest(
    string LicenseKey,
    Guid ActivationId);

public sealed record HeartbeatResponse(
    string HeartbeatToken);     // renewed signed marker

// ── Deactivate ────────────────────────────────────────────────────────────────

public sealed record DeactivateRequest(
    string LicenseKey,
    Guid ActivationId);

// ── Public key ────────────────────────────────────────────────────────────────

public sealed record ClientPublicKeyResponse(
    string PublicKey);          // hex-encoded Ed25519 public key

// ── Heartbeat history (for panel) ─────────────────────────────────────────────

public sealed record ActivationDto(
    Guid Id,
    string? HwFingerprint,
    string? MachineName,
    string Status,
    DateTimeOffset ActivatedAt,
    DateTimeOffset? LastHeartbeatAt,
    DateTimeOffset? DeactivatedAt);

public sealed record HeartbeatDto(
    Guid Id,
    Guid ActivationId,
    DateTimeOffset OccurredAt);
