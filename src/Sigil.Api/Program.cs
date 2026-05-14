using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Sigil.Application.Interfaces;
using Sigil.Application.Services;
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
    builder.Services.AddScoped<ICompanyRepository, Sigil.Infrastructure.Repositories.CompanyRepository>();
    builder.Services.AddScoped<ILicenseTemplateRepository, Sigil.Infrastructure.Repositories.LicenseTemplateRepository>();
    builder.Services.AddScoped<ILicenseRepository, Sigil.Infrastructure.Repositories.LicenseRepository>();
    builder.Services.AddScoped<IUserRepository, Sigil.Infrastructure.Repositories.UserRepository>();

    // Services
    builder.Services.AddScoped<CompanyService>();
    builder.Services.AddScoped<LicenseTemplateService>();
    builder.Services.AddScoped<LicenseService>();
    builder.Services.AddScoped<AuthService>();

    // Signer
    builder.Services.AddScoped<ISigner, EncryptedFileSigner>();

    // Auth — cookie-based
    builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
        .AddCookie(options =>
        {
            options.Cookie.Name = "sigil.auth";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            options.ExpireTimeSpan = TimeSpan.FromDays(7);
            options.SlidingExpiration = true;
            options.LoginPath = "/login";
            options.LogoutPath = "/api/v1/panel/auth/logout";
            options.Events.OnRedirectToLogin = context =>
            {
                context.Response.StatusCode = 401;
                return Task.CompletedTask;
            };
        });
    builder.Services.AddAuthorization();

    // CORS — origins из SIGIL_CORS_ORIGINS (запятая-separated), fallback для dev
    var corsOrigins = (builder.Configuration["Cors:Origins"]
        ?? Environment.GetEnvironmentVariable("SIGIL_CORS_ORIGINS")
        ?? "http://localhost:5173")
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    builder.Services.AddCors(options =>
    {
        options.AddDefaultPolicy(policy =>
        {
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials();
        });
    });

    // Health checks
    var connectionString = builder.Configuration.GetConnectionString("Default");
    builder.Services.AddHealthChecks()
        .AddNpgSql(connectionString!, name: "postgresql", tags: ["ready"]);

    builder.Services.AddControllers();

    var app = builder.Build();

    // Seed initial operator user
    using (var scope = app.Services.CreateScope())
    {
        var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
        var seedEmail = builder.Configuration["Seed:OperatorEmail"] ?? "admin@sigil.local";
        var seedPassword = builder.Configuration["Seed:OperatorPassword"] ?? "changeme";
        await auth.SeedOperatorAsync(seedEmail, seedPassword);
    }

    app.UseSerilogRequestLogging();
    app.UseCors();
    app.UseAuthentication();
    app.UseAuthorization();
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
