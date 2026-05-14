using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Dtos;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/templates")]
public sealed class LicenseTemplatesController : ControllerBase
{
    private readonly LicenseTemplateService _service;

    public LicenseTemplatesController(LicenseTemplateService service) => _service = service;

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
        var template = await _service.GetAsync(id, ct);
        return template is null ? NotFound() : Ok(template);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] LicenseTemplateCreateRequest req, CancellationToken ct)
    {
        var template = await _service.CreateAsync(req, ct);
        return CreatedAtAction(nameof(Get), new { id = template.Id }, template);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] LicenseTemplateUpdateRequest req, CancellationToken ct)
    {
        var template = await _service.UpdateAsync(id, req, ct);
        return template is null ? NotFound() : Ok(template);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }

    // ── Versions ──────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/versions")]
    public async Task<IActionResult> GetVersions(Guid id, CancellationToken ct)
    {
        var versions = await _service.GetVersionsAsync(id, ct);
        return Ok(versions);
    }

    [HttpPost("{id:guid}/versions")]
    public async Task<IActionResult> CreateVersion(Guid id, [FromBody] CreateTemplateVersionRequest req, CancellationToken ct)
    {
        var version = await _service.CreateVersionAsync(id, req, ct);
        return Ok(version);
    }
}
