using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Dtos;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/licenses")]
[Authorize]
public sealed class LicensesController : ControllerBase
{
    private readonly LicenseService _service;
    private readonly ClientLicenseService _clientService;

    public LicensesController(LicenseService service, ClientLicenseService clientService)
    {
        _service = service;
        _clientService = clientService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] Guid? companyId, CancellationToken ct)
    {
        if (companyId.HasValue)
        {
            var list = await _service.GetByCompanyAsync(companyId.Value, ct);
            return Ok(list);
        }
        var all = await _service.GetAllAsync(ct);
        return Ok(all);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var license = await _service.GetAsync(id, ct);
        return license is null ? NotFound() : Ok(license);
    }

    [HttpPost]
    public async Task<IActionResult> Issue([FromBody] LicenseCreateRequest req, CancellationToken ct)
    {
        try
        {
            var result = await _service.IssueAsync(req, ct);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:guid}/revoke")]
    public async Task<IActionResult> Revoke(Guid id, [FromBody] LicenseRevokeRequest? req, CancellationToken ct)
    {
        var revoked = await _service.RevokeAsync(id, req?.Reason, ct);
        return revoked ? NoContent() : NotFound();
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var dto = await _service.GetDownloadAsync(id, ct);
        if (dto is null) return NotFound();

        var json = System.Text.Json.JsonSerializer.Serialize(dto);
        var bytes = System.Text.Encoding.UTF8.GetBytes(json);
        return File(bytes, "application/octet-stream", $"{dto.LicenseKey}.sigil");
    }

    [HttpGet("{id:guid}/public-key")]
    public async Task<IActionResult> PublicKey(Guid id, CancellationToken ct)
    {
        var hex = await _service.GetPublicKeyAsync(id, ct);
        return hex is null ? NotFound() : Ok(hex);
    }

    [HttpGet("{id:guid}/activations")]
    public async Task<IActionResult> GetActivations(Guid id, CancellationToken ct)
    {
        var result = await _clientService.GetActivationsAsync(id, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/heartbeats")]
    public async Task<IActionResult> GetHeartbeats(Guid id, CancellationToken ct)
    {
        var result = await _clientService.GetHeartbeatsAsync(id, ct);
        return Ok(result);
    }
}
