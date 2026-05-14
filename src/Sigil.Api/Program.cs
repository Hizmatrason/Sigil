using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;

const string ServiceName = "sigil-api";

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console(new Serilog.Formatting.Compact.CompactJsonFormatter())
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((ctx, services, cfg) => cfg
        .ReadFrom.Configuration(ctx.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .Enrich.WithMachineName()
        .Enrich.WithEnvironmentName()
        .Enrich.WithProperty("service", ServiceName));

    var otelEndpoint = builder.Configuration["Otel:Endpoint"];

    builder.Services.AddOpenTelemetry()
        .ConfigureResource(r => r
            .AddService(ServiceName, serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString() ?? "0.0.0"))
        .WithTracing(t =>
        {
            t.AddAspNetCoreInstrumentation()
             .AddHttpClientInstrumentation();
            if (!string.IsNullOrWhiteSpace(otelEndpoint))
            {
                t.AddOtlpExporter(o => o.Endpoint = new Uri(otelEndpoint));
            }
        })
        .WithMetrics(m =>
        {
            m.AddAspNetCoreInstrumentation()
             .AddHttpClientInstrumentation()
             .AddRuntimeInstrumentation()
             .AddMeter("Sigil.*");
            if (!string.IsNullOrWhiteSpace(otelEndpoint))
            {
                m.AddOtlpExporter(o => o.Endpoint = new Uri(otelEndpoint));
            }
        });

    builder.Services.AddHealthChecks();

    var app = builder.Build();

    app.UseSerilogRequestLogging();

    app.MapHealthChecks("/health/live");
    app.MapHealthChecks("/health/ready");
    app.MapGet("/health", () => Results.Ok(new { status = "ok", service = ServiceName }));

    app.Run();
}
catch (Exception ex) when (ex is not OperationCanceledException)
{
    Log.Fatal(ex, "Sigil.Api terminated unexpectedly");
    throw;
}
finally
{
    await Log.CloseAndFlushAsync();
}

namespace Sigil.Api
{
    public sealed class Program;
}
