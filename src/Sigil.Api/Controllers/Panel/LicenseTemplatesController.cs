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
    public async Task<IActionResult> GetByCompany([FromQuery] Guid companyId, CancellationToken ct)
    {
        var list = await _service.GetByCompanyAsync(companyId, ct);
        return Ok(list);
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
}
