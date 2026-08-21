using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Services;

public sealed class BillingMasterSeedService(BillingDbContext db)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        var company = await db.Companies
            .Where(x => x.IsActive)
            .OrderBy(x => x.Code)
            .FirstOrDefaultAsync(cancellationToken);

        if (company is null)
            return;

        var salespersons = new[]
        {
            new Salesperson { CompanyId = company.Id, Code = "SP001", Name = "Arun Kumar", Mobile = "9876543210", IsActive = true },
            new Salesperson { CompanyId = company.Id, Code = "SP002", Name = "Priya Sharma", Mobile = "9876543211", IsActive = true },
            new Salesperson { CompanyId = company.Id, Code = "SP003", Name = "Vignesh Raj", Mobile = "9876543212", IsActive = true }
        };

        foreach (var salesperson in salespersons)
        {
            var exists = await db.Salespersons.AnyAsync(
                x => x.CompanyId == company.Id && x.Code == salesperson.Code,
                cancellationToken);

            if (!exists)
                db.Salespersons.Add(salesperson);
        }

        // Billing segregation: only CASHIER and BILLING_USER are permitted to create POS invoices.
        // Accounts has its own payment-confirmation workflow and does not create invoices.
        var workflowUsers = new[]
        {
            new AppUser { CompanyId = company.Id, UserName = "cashier", DisplayName = "Cashier", Role = "CASHIER", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "billing", DisplayName = "Billing User", Role = "BILLING_USER", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "branchmanager", DisplayName = "Branch Manager", Role = "BRANCH_MANAGER", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "accounts", DisplayName = "Accounts", Role = "ACCOUNTS", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "accountant", DisplayName = "Accounts", Role = "ACCOUNTS", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "warehouse", DisplayName = "Warehouse", Role = "WAREHOUSE", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "admin", DisplayName = "Administrator", Role = "ADMIN", IsActive = true }
        };

        foreach (var seedUser in workflowUsers)
        {
            var existingUser = await db.AppUsers
                .FirstOrDefaultAsync(x => x.UserName == seedUser.UserName, cancellationToken);

            if (existingUser is null)
            {
                db.AppUsers.Add(seedUser);
                continue;
            }

            // Existing local users were historically allowed to retain stale/incorrect roles.
            // Always reconcile the known built-in workflow accounts to their canonical roles.
            if (!string.Equals(existingUser.Role, seedUser.Role, StringComparison.OrdinalIgnoreCase))
                existingUser.Role = seedUser.Role;

            if (existingUser.CompanyId is null)
                existingUser.CompanyId = company.Id;

            if (string.IsNullOrWhiteSpace(existingUser.DisplayName))
                existingUser.DisplayName = seedUser.DisplayName;
        }

        var validFrom = DateTime.Today;
        var validTo = validFrom.AddMonths(6);

        var promotions = new[]
        {
            new Promotion { CompanyId = company.Id, Code = "WELCOME5", Name = "Welcome 5%", DiscountPercent = 5m, ValidFrom = validFrom, ValidTo = validTo, IsActive = true, IsCombinable = false, Priority = 10, Remarks = "Standard customer welcome promotion" },
            new Promotion { CompanyId = company.Id, Code = "SUMMER10", Name = "Summer Season 10%", DiscountPercent = 10m, ValidFrom = validFrom, ValidTo = validTo, IsActive = true, IsCombinable = false, Priority = 20, Remarks = "Seasonal retail promotion" },
            new Promotion { CompanyId = company.Id, Code = "BULK15", Name = "Bulk Order 15%", DiscountPercent = 15m, ValidFrom = validFrom, ValidTo = validTo, IsActive = true, IsCombinable = false, Priority = 30, Remarks = "Bulk order promotion" }
        };

        foreach (var promotion in promotions)
        {
            var exists = await db.Promotions.AnyAsync(
                x => x.CompanyId == company.Id && x.Code == promotion.Code,
                cancellationToken);

            if (!exists)
                db.Promotions.Add(promotion);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
