using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Services;

public sealed class CategoryPricingService(BillingDbContext db)
{
    public async Task<Dictionary<Guid, decimal>> GetEffectivePricesAsync(
        Guid? customerId,
        IReadOnlyCollection<(Guid ProductId, decimal StandardPrice)> products,
        DateTime effectiveDate,
        CancellationToken ct)
    {
        var result = products.ToDictionary(x => x.ProductId, x => x.StandardPrice);
        if (!customerId.HasValue || products.Count == 0)
            return result;

        var assignment = await db.CustomerCategoryAssignments
            .AsNoTracking()
            .Where(x => x.CustomerId == customerId.Value)
            .Select(x => new { x.CategoryId })
            .FirstOrDefaultAsync(ct);

        if (assignment is null)
            return result;

        var productIds = products.Select(x => x.ProductId).Distinct().ToList();
        var date = effectiveDate.Date;

        var rules = await db.CategoryPriceRules
            .AsNoTracking()
            .Where(x => x.CategoryId == assignment.CategoryId
                && (x.ProductId == null || productIds.Contains(x.ProductId.Value))
                && x.IsActive
                && x.ValidFrom <= date
                && x.ValidTo >= date)
            .Select(x => new
            {
                x.ProductId,
                x.FixedPrice,
                x.DiscountPercent,
                x.Priority
            })
            .ToListAsync(ct);

        foreach (var product in products)
        {
            var rule = rules
                .Where(x => x.ProductId == product.ProductId || x.ProductId == null)
                .OrderByDescending(x => x.ProductId.HasValue)
                .ThenByDescending(x => x.Priority)
                .FirstOrDefault();

            if (rule is null)
                continue;

            result[product.ProductId] = rule.FixedPrice.HasValue
                ? Math.Max(0m, rule.FixedPrice.Value)
                : Math.Max(0m, Math.Round(
                    product.StandardPrice * (1m - (rule.DiscountPercent ?? 0m) / 100m),
                    2,
                    MidpointRounding.AwayFromZero));
        }

        return result;
    }

    // Compatibility wrapper for existing callers.
    public async Task<decimal> GetEffectivePriceAsync(
        Guid? customerId,
        Guid productId,
        decimal standardPrice,
        DateTime effectiveDate,
        CancellationToken ct)
    {
        var prices = await GetEffectivePricesAsync(
            customerId,
            new[] { (productId, standardPrice) },
            effectiveDate,
            ct);

        return prices[productId];
    }
}
