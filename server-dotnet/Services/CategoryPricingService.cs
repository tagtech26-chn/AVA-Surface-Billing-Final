using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;
namespace AVASurface.Server.Services;
public sealed class CategoryPricingService(BillingDbContext db)
{
 public async Task<decimal> GetEffectivePriceAsync(Guid? customerId,Guid productId,decimal standardPrice,DateTime effectiveDate,CancellationToken ct)
 {
  if(!customerId.HasValue)return standardPrice;
  var assignment=await db.CustomerCategoryAssignments.AsNoTracking().FirstOrDefaultAsync(x=>x.CustomerId==customerId.Value,ct);
  if(assignment is null)return standardPrice;
  var date=effectiveDate.Date;
  var rule=await db.CategoryPriceRules.AsNoTracking().Where(x=>x.CategoryId==assignment.CategoryId&&(x.ProductId==productId||x.ProductId==null)&&x.IsActive&&x.ValidFrom<=date&&x.ValidTo>=date).OrderByDescending(x=>x.ProductId.HasValue).ThenByDescending(x=>x.Priority).FirstOrDefaultAsync(ct);
  if(rule is null)return standardPrice;
  if(rule.FixedPrice.HasValue)return Math.Max(0m,rule.FixedPrice.Value);
  return Math.Max(0m,Math.Round(standardPrice*(1m-(rule.DiscountPercent??0m)/100m),2,MidpointRounding.AwayFromZero));
 }
}
