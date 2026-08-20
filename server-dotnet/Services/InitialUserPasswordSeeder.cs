using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Services;

/// <summary>
/// Ensures the built-in local/demo accounts have known credentials.
/// This is intentionally deterministic for the local billing deployment so a stale
/// database hash cannot lock the seeded workflow accounts out.
/// Production deployments should replace these accounts/passwords with managed users.
/// </summary>
public sealed class InitialUserPasswordSeeder(BillingDbContext db, IWebHostEnvironment environment)
{
    private static readonly IReadOnlyDictionary<string, string> Passwords = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["cashier"] = "Cashier@123",
        ["billing"] = "Billing@123",
        ["branchmanager"] = "Manager@123",
        ["accounts"] = "Accounts@123",
        ["warehouse"] = "Warehouse@123",
        ["admin"] = "Admin@123"
    };

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        foreach (var pair in Passwords)
        {
            var user = await db.AppUsers.FirstOrDefaultAsync(x => x.UserName == pair.Key, cancellationToken);
            if (user is null || !user.IsActive)
                continue;

            // Local/demo accounts must remain usable after an older database seed has
            // left an incompatible or stale PasswordHash behind.
            if (environment.IsDevelopment())
                user.PasswordHash = PasswordHasher.Hash(pair.Value);
            else if (string.IsNullOrWhiteSpace(user.PasswordHash))
                user.PasswordHash = PasswordHasher.Hash(pair.Value);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
