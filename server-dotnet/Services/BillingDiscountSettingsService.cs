using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Services;

public sealed class BillingDiscountSettingsService(BillingDbContext db)
{
    public async Task EnsureSchemaAsync(CancellationToken ct = default)
    {
        await db.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'dbo.BillingDiscountSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.BillingDiscountSettings
    (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_BillingDiscountSettings PRIMARY KEY,
        CompanyId uniqueidentifier NOT NULL,
        DefaultSalespersonDiscountPercent decimal(5,2) NOT NULL CONSTRAINT DF_BillingDiscountSettings_Default DEFAULT (0),
        MaxSalespersonDiscountPercent decimal(5,2) NOT NULL CONSTRAINT DF_BillingDiscountSettings_Max DEFAULT (0),
        UpdatedAtUtc datetime2 NOT NULL CONSTRAINT DF_BillingDiscountSettings_Updated DEFAULT (SYSUTCDATETIME()),
        UpdatedByUserId uniqueidentifier NULL,
        CONSTRAINT UQ_BillingDiscountSettings_Company UNIQUE (CompanyId),
        CONSTRAINT CK_BillingDiscountSettings_DefaultNonNegative CHECK (DefaultSalespersonDiscountPercent >= 0 AND DefaultSalespersonDiscountPercent <= 100),
        CONSTRAINT CK_BillingDiscountSettings_MaxNonNegative CHECK (MaxSalespersonDiscountPercent >= 0 AND MaxSalespersonDiscountPercent <= 100),
        CONSTRAINT CK_BillingDiscountSettings_DefaultLEMax CHECK (DefaultSalespersonDiscountPercent <= MaxSalespersonDiscountPercent),
        CONSTRAINT FK_BillingDiscountSettings_Company FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id)
    );
END", ct);
    }

    public async Task<Guid?> GetUserCompanyIdAsync(Guid? userId, CancellationToken ct = default)
    {
        if (!userId.HasValue) return null;
        return await db.AppUsers.AsNoTracking().Where(x => x.Id == userId.Value && x.IsActive).Select(x => x.CompanyId).SingleOrDefaultAsync(ct);
    }

    public async Task<BillingDiscountSettings?> GetAsync(Guid companyId, CancellationToken ct = default)
        => await db.Database.SqlQueryRaw<BillingDiscountSettings>(@"
SELECT Id, CompanyId, DefaultSalespersonDiscountPercent, MaxSalespersonDiscountPercent, UpdatedAtUtc, UpdatedByUserId
FROM dbo.BillingDiscountSettings
WHERE CompanyId = {0}", companyId).SingleOrDefaultAsync(ct);

    public async Task<BillingDiscountSettings> GetOrCreateAsync(Guid companyId, CancellationToken ct = default)
    {
        var existing = await GetAsync(companyId, ct);
        if (existing is not null) return existing;

        var settings = new BillingDiscountSettings { CompanyId = companyId };
        await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO dbo.BillingDiscountSettings
    (Id, CompanyId, DefaultSalespersonDiscountPercent, MaxSalespersonDiscountPercent, UpdatedAtUtc, UpdatedByUserId)
VALUES
    ({settings.Id}, {settings.CompanyId}, {settings.DefaultSalespersonDiscountPercent}, {settings.MaxSalespersonDiscountPercent}, {settings.UpdatedAtUtc}, {settings.UpdatedByUserId});", ct);
        return settings;
    }

    public async Task<BillingDiscountSettings> UpdateAsync(Guid companyId, decimal defaultPercent, decimal maxPercent, Guid? userId, CancellationToken ct = default)
    {
        if (defaultPercent < 0 || defaultPercent > 100) throw new ArgumentException("Default salesperson discount must be between 0% and 100%.");
        if (maxPercent < 0 || maxPercent > 100) throw new ArgumentException("Maximum salesperson discount must be between 0% and 100%.");
        if (defaultPercent > maxPercent) throw new ArgumentException("Default salesperson discount cannot exceed the maximum salesperson discount.");

        var settings = await GetOrCreateAsync(companyId, ct);
        settings.DefaultSalespersonDiscountPercent = defaultPercent;
        settings.MaxSalespersonDiscountPercent = maxPercent;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        settings.UpdatedByUserId = userId;

        await db.Database.ExecuteSqlInterpolatedAsync($@"
UPDATE dbo.BillingDiscountSettings
SET DefaultSalespersonDiscountPercent = {settings.DefaultSalespersonDiscountPercent},
    MaxSalespersonDiscountPercent = {settings.MaxSalespersonDiscountPercent},
    UpdatedAtUtc = {settings.UpdatedAtUtc},
    UpdatedByUserId = {settings.UpdatedByUserId}
WHERE CompanyId = {companyId};", ct);

        return settings;
    }
}
