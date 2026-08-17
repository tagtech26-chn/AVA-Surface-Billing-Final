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
        // All other workflow roles are deliberately excluded from the billing-user seed set.
        var workflowUsers = new[]
        {
            new AppUser { CompanyId = company.Id, UserName = "cashier", DisplayName = "Cashier", Role = "CASHIER", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "billing", DisplayName = "Billing User", Role = "BILLING_USER", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "branchmanager", DisplayName = "Branch Manager", Role = "BRANCH_MANAGER", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "accounts", DisplayName = "Accounts", Role = "ACCOUNTS", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "warehouse", DisplayName = "Warehouse", Role = "WAREHOUSE", IsActive = true },
            new AppUser { CompanyId = company.Id, UserName = "admin", DisplayName = "Administrator", Role = "ADMIN", IsActive = true }
        };

        foreach (var user in workflowUsers)
        {
            var exists = await db.AppUsers.AnyAsync(
                x => x.UserName == user.UserName,
                cancellationToken);

            if (!exists)
                db.AppUsers.Add(user);
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
