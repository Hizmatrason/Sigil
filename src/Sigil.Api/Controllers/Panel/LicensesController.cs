using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Dtos;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/licenses")]
public sealed class LicensesController : ControllerBase
{
    private readonly LicenseService _service;

    public LicensesController(LicenseService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetByCompany([FromQuery] Guid companyId, CancellationToken ct)
    {
        var list = await _service.GetByCompanyAsync(companyId, ct);
        return Ok(list);
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
        var result = await _service.IssueAsync(req, ct);
        return Ok(result);
    }
}
