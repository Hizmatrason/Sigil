using System.Text.Json;
using Sigil.Application.Dtos;
using Sigil.Application.Interfaces;
using Sigil.Domain.Entities;
using Sigil.Domain.Enums;

namespace Sigil.Application.Services;

public sealed class WebhookService
{
    private readonly IWebhookEndpointRepository _endpointRepo;
    private readonly IWebhookDeliveryRepository _deliveryRepo;

    public WebhookService(
        IWebhookEndpointRepository endpointRepo,
        IWebhookDeliveryRepository deliveryRepo)
    {
        _endpointRepo = endpointRepo;
        _deliveryRepo = deliveryRepo;
    }

    // ── Endpoints ────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<WebhookEndpointDto>> GetAllEndpointsAsync(CancellationToken ct = default)
    {
        var list = await _endpointRepo.GetAllAsync(ct);
        return list.Select(MapEndpoint).ToList();
    }

    public async Task<WebhookEndpointDto?> GetEndpointAsync(Guid id, CancellationToken ct = default)
    {
        var ep = await _endpointRepo.GetByIdAsync(id, ct);
        return ep is null ? null : MapEndpoint(ep);
    }

    public async Task<WebhookEndpointDto> CreateEndpointAsync(CreateWebhookEndpointRequest req, CancellationToken ct = default)
    {
        var ep = new WebhookEndpoint
        {
            Url = req.Url,
            Secret = req.Secret,
            Description = req.Description,
            IsActive = true,
            Events = req.Events,
        };
        await _endpointRepo.AddAsync(ep, ct);
        await _endpointRepo.SaveChangesAsync(ct);
        return MapEndpoint(ep);
    }

    public async Task<WebhookEndpointDto?> UpdateEndpointAsync(Guid id, UpdateWebhookEndpointRequest req, CancellationToken ct = default)
    {
        var ep = await _endpointRepo.GetByIdAsync(id, ct);
        if (ep is null) return null;

        if (req.Url is not null) ep.Url = req.Url;
        if (req.Secret is not null) ep.Secret = req.Secret;
        if (req.Description is not null) ep.Description = req.Description;
        if (req.IsActive.HasValue) ep.IsActive = req.IsActive.Value;
        if (req.Events is not null) ep.Events = req.Events;
        ep.UpdatedAt = DateTimeOffset.UtcNow;

        await _endpointRepo.SaveChangesAsync(ct);
        return MapEndpoint(ep);
    }

    public async Task<bool> DeleteEndpointAsync(Guid id, CancellationToken ct = default)
    {
        var ep = await _endpointRepo.GetByIdAsync(id, ct);
        if (ep is null) return false;
        await _endpointRepo.DeleteAsync(ep, ct);
        await _endpointRepo.SaveChangesAsync(ct);
        return true;
    }

    // ── Deliveries ───────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<WebhookDeliveryDto>> GetDeliveriesAsync(Guid endpointId, int limit = 50, CancellationToken ct = default)
    {
        var list = await _deliveryRepo.GetByEndpointAsync(endpointId, limit, ct);
        return list.Select(MapDelivery).ToList();
    }

    public async Task<bool> ReplayAsync(Guid deliveryId, CancellationToken ct = default)
    {
        var delivery = await _deliveryRepo.GetByIdAsync(deliveryId, ct);
        if (delivery is null) return false;

        delivery.Status = WebhookDeliveryStatus.Pending;
        delivery.AttemptCount = 0;
        delivery.NextAttemptAt = DateTimeOffset.UtcNow;
        delivery.LastError = null;
        delivery.ResponseStatusCode = null;
        delivery.ResponseBody = null;
        await _deliveryRepo.SaveChangesAsync(ct);
        return true;
    }

    // ── Publishing ───────────────────────────────────────────────────────────

    /// <summary>Fan-out: create one WebhookDelivery per subscribed active endpoint.</summary>
    public async Task PublishEventAsync(string eventType, object eventData, CancellationToken ct = default)
    {
        var endpoints = await _endpointRepo.GetActiveByEventAsync(eventType, ct);
        if (endpoints.Count == 0) return;

        var envelope = new WebhookEnvelope(eventType, DateTimeOffset.UtcNow, eventData);
        var payload = JsonSerializer.Serialize(envelope, JsonOpts.CamelCase);

        var deliveries = endpoints.Select(ep => new WebhookDelivery
        {
            EndpointId = ep.Id,
            EventType = eventType,
            Payload = payload,
            Status = WebhookDeliveryStatus.Pending,
            AttemptCount = 0,
            NextAttemptAt = DateTimeOffset.UtcNow,
        }).ToList();

        await _deliveryRepo.AddRangeAsync(deliveries, ct);
        await _deliveryRepo.SaveChangesAsync(ct);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static WebhookEndpointDto MapEndpoint(WebhookEndpoint ep)
        => new(ep.Id, ep.Url, ep.Description, ep.IsActive, ep.Events, ep.LastDeliveryAt, ep.CreatedAt);

    private static WebhookDeliveryDto MapDelivery(WebhookDelivery d)
        => new(d.Id, d.EndpointId, d.EventType, d.Payload, d.Status.ToString(),
               d.AttemptCount, d.ResponseStatusCode, d.ResponseBody, d.LastError,
               d.NextAttemptAt, d.LastAttemptAt, d.CreatedAt);
}

file sealed record WebhookEnvelope(string Event, DateTimeOffset OccurredAt, object Data);

file static class JsonOpts
{
    public static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };
}
