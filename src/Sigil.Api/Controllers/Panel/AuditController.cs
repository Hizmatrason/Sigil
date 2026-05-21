using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/audit")]
[Authorize]
public sealed class AuditController : ControllerBase
{
    private readonly AuditService _service;

    public AuditController(AuditService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> Query(
        [FromQuery] string? action,
        [FromQuery] string? actorEmail,
        [FromQuery] string? entityType,
        [FromQuery] Guid? entityId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? until,
        [FromQuery] int limit = 100,
        [FromQuery] int offset = 0,
        CancellationToken ct = default)
    {
        var list = await _service.QueryAsync(action, actorEmail, entityType, entityId, from, until, limit, offset, ct);
        return Ok(list);
    }
}
