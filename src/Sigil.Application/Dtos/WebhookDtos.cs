namespace Sigil.Application.Dtos;

public sealed record WebhookEndpointDto(
    Guid Id,
    string Url,
    string Description,
    bool IsActive,
    string[] Events,
    DateTimeOffset? LastDeliveryAt,
    DateTimeOffset CreatedAt);

public sealed record CreateWebhookEndpointRequest(
    string Url,
    string Secret,
    string Description,
    string[] Events);

public sealed record UpdateWebhookEndpointRequest(
    string? Url,
    string? Secret,
    string? Description,
    bool? IsActive,
    string[]? Events);

public sealed record WebhookDeliveryDto(
    Guid Id,
    Guid EndpointId,
    string EventType,
    string Payload,
    string Status,
    int AttemptCount,
    int? ResponseStatusCode,
    string? ResponseBody,
    string? LastError,
    DateTimeOffset? NextAttemptAt,
    DateTimeOffset? LastAttemptAt,
    DateTimeOffset CreatedAt);
