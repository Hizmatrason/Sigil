using Microsoft.EntityFrameworkCore;
using Sigil.Infrastructure.Data;
using Testcontainers.PostgreSql;

namespace Sigil.Infrastructure.Tests;

#pragma warning disable CA1001 // Types that own disposable fields should be disposable — disposal via IAsyncLifetime
public sealed class DatabaseMigrationTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("sigil_test")
        .WithUsername("sigil")
        .WithPassword("sigil_test")
        .Build();

    private SigilDbContext _dbContext = null!;

    [Fact]
    public async Task Migration_Applies_Successfully()
    {
        // Act
        await _dbContext.Database.MigrateAsync();

        // Assert — migration applied without error; verify extensions exist
        var canConnect = await _dbContext.Database.CanConnectAsync();
        Assert.True(canConnect);

        // Verify pgcrypto extension is installed
        var pgcrypto = await _dbContext.Database
            .SqlQuery<string>($"SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'")
            .ToListAsync();
        Assert.Single(pgcrypto);

        // Verify ltree extension is installed
        var ltree = await _dbContext.Database
            .SqlQuery<string>($"SELECT extname FROM pg_extension WHERE extname = 'ltree'")
            .ToListAsync();
        Assert.Single(ltree);
    }

    public async Task InitializeAsync()
    {
        await _db.StartAsync();

        var options = new DbContextOptionsBuilder<SigilDbContext>()
            .UseNpgsql(_db.GetConnectionString())
            .UseSnakeCaseNamingConvention()
            .Options;

        _dbContext = new SigilDbContext(options);
    }

    public async Task DisposeAsync()
    {
        await _dbContext.DisposeAsync();
        await _db.DisposeAsync();
    }
}
