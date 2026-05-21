using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;

namespace Sigil.Application.Services;

public sealed class AuditService
{
    private readonly IAuditLogRepository _repo;
    private readonly IHttpContextAccessor _httpContext;

    public AuditService(IAuditLogRepository repo, IHttpContextAccessor httpContext)
    {
        _repo = repo;
        _httpContext = httpContext;
    }

    public async Task LogAsync(
        string action,
        string entityType,
        Guid? entityId,
        object? meta = null,
        string? actorEmail = null,
        CancellationToken ct = default)
    {
        var ctx = _httpContext.HttpContext;
        var actor = actorEmail
            ?? ctx?.User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
            ?? ctx?.User.Identity?.Name;

        var ip = ctx?.Connection.RemoteIpAddress?.ToString();

        var entry = new AuditLog
        {
            Action = action,
            ActorEmail = actor,
            EntityType = entityType,
            EntityId = entityId,
            Meta = meta is null ? null : JsonSerializer.Serialize(meta, JsonOpts.CamelCase),
            IpAddress = ip,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        await _repo.AddAsync(entry, ct);
        await _repo.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AuditLogDto>> QueryAsync(
        string? action,
        string? actorEmail,
        string? entityType,
        Guid? entityId,
        DateTimeOffset? from,
        DateTimeOffset? until,
        int limit = 100,
        int offset = 0,
        CancellationToken ct = default)
    {
        var list = await _repo.QueryAsync(action, actorEmail, entityType, entityId, from, until, limit, offset, ct);
        return list.Select(a => new AuditLogDto(
            a.Id, a.Action, a.ActorEmail, a.EntityType, a.EntityId,
            a.Meta, a.IpAddress, a.CreatedAt)).ToList();
    }
}

file static class JsonOpts
{
    public static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };
}
