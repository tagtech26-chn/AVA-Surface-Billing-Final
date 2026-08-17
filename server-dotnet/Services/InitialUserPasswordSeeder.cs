using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Services;

public sealed class InitialUserPasswordSeeder(BillingDbContext db)
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

            if (string.IsNullOrWhiteSpace(user.PasswordHash))
                user.PasswordHash = PasswordHasher.Hash(pair.Value);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
