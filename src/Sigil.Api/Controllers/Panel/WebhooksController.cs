using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Dtos;
using Sigil.Application.Services;
using Sigil.Domain.Webhooks;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/webhooks")]
[Authorize]
public sealed class WebhooksController : ControllerBase
{
    private readonly WebhookService _service;

    public WebhooksController(WebhookService service) => _service = service;

    // ── Endpoints ─────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _service.GetAllEndpointsAsync(ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetOne(Guid id, CancellationToken ct)
    {
        var ep = await _service.GetEndpointAsync(id, ct);
        return ep is null ? NotFound() : Ok(ep);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateWebhookEndpointRequest req, CancellationToken ct)
    {
        var ep = await _service.CreateEndpointAsync(req, ct);
        return CreatedAtAction(nameof(GetOne), new { id = ep.Id }, ep);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateWebhookEndpointRequest req, CancellationToken ct)
    {
        var ep = await _service.UpdateEndpointAsync(id, req, ct);
        return ep is null ? NotFound() : Ok(ep);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteEndpointAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    // ── Deliveries ────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/deliveries")]
    public async Task<IActionResult> GetDeliveries(Guid id, [FromQuery] int limit = 50, CancellationToken ct = default)
        => Ok(await _service.GetDeliveriesAsync(id, limit, ct));

    [HttpPost("deliveries/{deliveryId:guid}/replay")]
    public async Task<IActionResult> Replay(Guid deliveryId, CancellationToken ct)
    {
        var ok = await _service.ReplayAsync(deliveryId, ct);
        return ok ? NoContent() : NotFound();
    }

    // ── Event type list ───────────────────────────────────────────────────

    [HttpGet("event-types")]
    public IActionResult GetEventTypes() => Ok(WebhookEventTypes.All);
}
