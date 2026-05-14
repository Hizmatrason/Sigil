using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Sigil.Application.Interfaces;
using Sigil.Infrastructure.Data;
using Sigil.Infrastructure.Signing;

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

    // EF Core — Npgsql + snake_case naming convention
    builder.Services.AddDbContext<SigilDbContext>(options =>
    {
        options.UseNpgsql(builder.Configuration.GetConnectionString("Default"), npgsql =>
        {
            npgsql.MigrationsAssembly(typeof(SigilDbContext).Assembly.FullName);
        });
        options.UseSnakeCaseNamingConvention();
    });

    // Repositories
    builder.Services.AddScoped<Sigil.Application.Interfaces.ICompanyRepository, Sigil.Infrastructure.Repositories.CompanyRepository>();
    builder.Services.AddScoped<Sigil.Application.Interfaces.ILicenseTemplateRepository, Sigil.Infrastructure.Repositories.LicenseTemplateRepository>();
    builder.Services.AddScoped<Sigil.Application.Interfaces.ILicenseRepository, Sigil.Infrastructure.Repositories.LicenseRepository>();

    // Services
    builder.Services.AddScoped<Sigil.Application.Services.CompanyService>();
    builder.Services.AddScoped<Sigil.Application.Services.LicenseTemplateService>();
    builder.Services.AddScoped<Sigil.Application.Services.LicenseService>();

    // Signer
    builder.Services.AddScoped<Sigil.Application.Interfaces.ISigner, Sigil.Infrastructure.Signing.EncryptedFileSigner>();

    // Health checks
    var connectionString = builder.Configuration.GetConnectionString("Default");
    builder.Services.AddHealthChecks()
        .AddNpgSql(connectionString!, name: "postgresql", tags: ["ready"]);

    // Signing — EncryptedFileSigner reads SIGIL_MASTER_KEY env var
    builder.Services.AddScoped<ISigner, EncryptedFileSigner>();

    builder.Services.AddControllers();

    var app = builder.Build();

    app.UseSerilogRequestLogging();
    app.MapControllers();

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
