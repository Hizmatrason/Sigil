using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sigil.Application.Dtos;
using Sigil.Application.Services;

namespace Sigil.Api.Controllers.Panel;

[ApiController]
[Route("api/v1/panel/companies")]
[Authorize]
public sealed class CompaniesController : ControllerBase
{
    private readonly CompanyService _service;

    public CompaniesController(CompanyService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var list = await _service.GetAllAsync(ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        var company = await _service.GetAsync(id, ct);
        return company is null ? NotFound() : Ok(company);
    }

    [HttpGet("{id:guid}/children")]
    public async Task<IActionResult> GetChildren(Guid id, CancellationToken ct)
    {
        var list = await _service.GetChildrenAsync(id, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}/subtree")]
    public async Task<IActionResult> GetSubtree(Guid id, CancellationToken ct)
    {
        var list = await _service.GetSubtreeAsync(id, ct);
        return Ok(list);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CompanyCreateRequest req, CancellationToken ct)
    {
        var company = await _service.CreateAsync(req, ct);
        return CreatedAtAction(nameof(Get), new { id = company.Id }, company);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
