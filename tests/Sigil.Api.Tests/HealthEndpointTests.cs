using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Sigil.Api.Tests;

/// <summary>
/// Custom WebApplicationFactory that removes the Npgsql health check
/// for environments where PostgreSQL is not available (unit tests).
/// </summary>
public sealed class SigilTestFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace HealthCheckServiceOptions to clear Npgsql registrations
            // since no DB is available during unit tests.
            services.Configure<HealthCheckServiceOptions>(options =>
            {
                options.Registrations.Clear();
            });
        });
    }
}

public sealed class HealthEndpointTests : IClassFixture<SigilTestFactory>
{
    private readonly SigilTestFactory _factory;

    public HealthEndpointTests(SigilTestFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_Returns_Ok()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
        Assert.Equal("sigil-api", body.Service);
    }

    [Fact]
    public async Task Health_Live_Returns_Ok()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Health_Ready_Returns_Ok()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private sealed record HealthResponse(string Status, string Service);
}
