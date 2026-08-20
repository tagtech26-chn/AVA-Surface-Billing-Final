using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace AVASurface.Server.Infrastructure;

/// <summary>
/// Provides BillingDbContext to EF Core tooling without bootstrapping the full
/// ASP.NET Core application. This keeps migrations independent of runtime-only
/// requirements such as JWT secrets, CORS validation, seeders, and hosted services.
/// </summary>
public sealed class BillingDbContextFactory : IDesignTimeDbContextFactory<BillingDbContext>
{
    public BillingDbContext CreateDbContext(string[] args)
    {
        var basePath = Directory.GetCurrentDirectory();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException("ConnectionStrings:DefaultConnection is required for EF Core migrations.");

        var options = new DbContextOptionsBuilder<BillingDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new BillingDbContext(options);
    }
}
