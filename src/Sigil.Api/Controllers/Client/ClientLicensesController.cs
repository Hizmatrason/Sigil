using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Sigil.Application.Dtos;
using Sigil.Application.Licensing;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Client;

/// <summary>
/// Client-facing API for license activation and heartbeat.
/// Not protected by cookie auth — uses HMAC-SHA256 request signatures instead.
/// </summary>
[ApiController]
[Route("api/v1/client")]
[EnableRateLimiting("client_api")]
public sealed class ClientLicensesController : ControllerBase
{
    private readonly ClientLicenseService _svc;

    public ClientLicensesController(ClientLicenseService svc) => _svc = svc;

    // POST /api/v1/client/activate
    // No HMAC required — the license key itself is the secret; first call establishes identity.
    [HttpPost("activate")]
    public async Task<IActionResult> Activate([FromBody] ActivateRequest req, CancellationToken ct)
    {
        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _svc.ActivateAsync(req, ip, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST /api/v1/client/heartbeat
    // Requires HMAC headers.
    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] HeartbeatRequest req, CancellationToken ct)
    {
        try
        {
            HmacValidator.Validate(
                req.LicenseKey,
                Request.Headers["X-Sigil-Timestamp"],
                Request.Headers["X-Sigil-Signature"]);

            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var result = await _svc.HeartbeatAsync(req, ip, ct);
            return Ok(result);
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST /api/v1/client/deactivate
    // Requires HMAC headers.
    [HttpPost("deactivate")]
    public async Task<IActionResult> Deactivate([FromBody] DeactivateRequest req, CancellationToken ct)
    {
        try
        {
            HmacValidator.Validate(
                req.LicenseKey,
                Request.Headers["X-Sigil-Timestamp"],
                Request.Headers["X-Sigil-Signature"]);

            await _svc.DeactivateAsync(req, ct);
            return NoContent();
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // GET /api/v1/client/public-key/{licenseKey}
    // Public — no auth needed; used by SDK to fetch the Ed25519 public key.
    [HttpGet("public-key/{licenseKey}")]
    public async Task<IActionResult> GetPublicKey(string licenseKey, CancellationToken ct)
    {
        var result = await _svc.GetPublicKeyAsync(licenseKey, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
