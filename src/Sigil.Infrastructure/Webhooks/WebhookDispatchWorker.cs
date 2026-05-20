using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Sigil.Domain.Enums;
using Sigil.Infrastructure.Data;

namespace Sigil.Infrastructure.Webhooks;

/// <summary>
/// Background service that polls for pending webhook deliveries and dispatches them with exponential retry.
/// Retry schedule (attempt → next delay): 1→+1min, 2→+5min, 3→+30min, 4→+2h, 5→+12h, >5→Failed.
/// </summary>
public sealed class WebhookDispatchWorker : BackgroundService
{
    private static readonly TimeSpan[] RetryDelays =
    [
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(30),
        TimeSpan.FromHours(2),
        TimeSpan.FromHours(12),
    ];

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<WebhookDispatchWorker> _logger;

    public WebhookDispatchWorker(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpFactory,
        ILogger<WebhookDispatchWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DispatchBatchAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Webhook dispatch batch failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken).ConfigureAwait(false);
        }
    }

    private async Task DispatchBatchAsync(CancellationToken ct)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<SigilDbContext>();

        var due = await db.WebhookDeliveries
            .Include(d => d.Endpoint)
            .Where(d => d.Status == WebhookDeliveryStatus.Pending
                     && d.NextAttemptAt <= DateTimeOffset.UtcNow)
            .OrderBy(d => d.NextAttemptAt)
            .Take(20)
            .ToListAsync(ct);

        if (due.Count == 0) return;

        var client = _httpFactory.CreateClient("webhook");
        var tasks = due.Select(d => SendAsync(client, d, db, ct));
        await Task.WhenAll(tasks);

        await db.SaveChangesAsync(ct);
    }

    private async Task SendAsync(HttpClient client, Domain.Entities.WebhookDelivery delivery, SigilDbContext db, CancellationToken ct)
    {
        var bodyBytes = Encoding.UTF8.GetBytes(delivery.Payload);
        var signature = ComputeHmac(delivery.Endpoint.Secret, bodyBytes);

        using var request = new HttpRequestMessage(HttpMethod.Post, delivery.Endpoint.Url);
        request.Content = new ByteArrayContent(bodyBytes);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        request.Headers.Add("X-Sigil-Event", delivery.EventType);
        request.Headers.Add("X-Sigil-Delivery", delivery.Id.ToString());
        request.Headers.Add("X-Sigil-Signature", $"sha256={signature}");

        var now = DateTimeOffset.UtcNow;
        delivery.AttemptCount++;
        delivery.LastAttemptAt = now;

        try
        {
            using var response = await client.SendAsync(request, ct);
            var body = await response.Content.ReadAsStringAsync(ct);

            delivery.ResponseStatusCode = (int)response.StatusCode;
            delivery.ResponseBody = body.Length > 2000 ? body[..2000] : body;

            if (response.IsSuccessStatusCode)
            {
                delivery.Status = WebhookDeliveryStatus.Success;
                delivery.NextAttemptAt = null;

                delivery.Endpoint.LastDeliveryAt = now;
                delivery.Endpoint.UpdatedAt = now;

                if (_logger.IsEnabled(LogLevel.Debug))
                    _logger.LogDebug("Webhook {DeliveryId} delivered to {Url}", delivery.Id, delivery.Endpoint.Url);
            }
            else
            {
                ScheduleRetryOrFail(delivery, now, $"HTTP {(int)response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            delivery.ResponseStatusCode = null;
            ScheduleRetryOrFail(delivery, now, ex.Message);
            _logger.LogWarning("Webhook {DeliveryId} send error: {Msg}", delivery.Id, ex.Message);
        }
    }

    private static void ScheduleRetryOrFail(Domain.Entities.WebhookDelivery delivery, DateTimeOffset now, string error)
    {
        delivery.LastError = error;

        // AttemptCount was already incremented before the send
        if (delivery.AttemptCount <= RetryDelays.Length)
        {
            delivery.Status = WebhookDeliveryStatus.Pending;
            delivery.NextAttemptAt = now + RetryDelays[delivery.AttemptCount - 1];
        }
        else
        {
            delivery.Status = WebhookDeliveryStatus.Failed;
            delivery.NextAttemptAt = null;
        }
    }

    private static string ComputeHmac(string secret, byte[] body)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var hash = HMACSHA256.HashData(keyBytes, body);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
