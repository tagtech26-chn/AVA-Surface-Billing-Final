using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/billing-categories")]
public sealed class BillingCategoriesController(BillingDbContext db) : ControllerBase
{
    private static readonly string[] DefaultCategories = { "RETAIL|Retail Sale", "WHOLESALE|Wholesale", "PROJECTS|Projects", "ENGINEERS_CONTRACTORS|Engineer & Contractors" };

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        await EnsureDefaults(cancellationToken);
        return Ok(await db.CustomerCategories.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.CompanyId, x.IsActive }).ToListAsync(cancellationToken));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPost]
    public async Task<IActionResult> Create(CreateBillingCategoryRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Billing category code and name are required.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.CustomerCategories.AnyAsync(x => x.Code == code, cancellationToken)) return Conflict("A billing category with this code already exists.");
        var category = new CustomerCategory { CompanyId = request.CompanyId, Code = code, Name = request.Name.Trim(), IsActive = true };
        db.CustomerCategories.Add(category); await db.SaveChangesAsync(cancellationToken); return Ok(category);
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPut("customer/{customerId:guid}")]
    public async Task<IActionResult> AssignCustomer(Guid customerId, AssignBillingCategoryRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == customerId, cancellationToken)) return NotFound("Customer not found.");
        if (!await db.CustomerCategories.AnyAsync(x => x.Id == request.CategoryId && x.IsActive, cancellationToken)) return NotFound("Billing category not found.");
        var assignment = await db.CustomerCategoryAssignments.FirstOrDefaultAsync(x => x.CustomerId == customerId, cancellationToken);
        if (assignment is null) db.CustomerCategoryAssignments.Add(new CustomerCategoryAssignment { CustomerId = customerId, CategoryId = request.CategoryId });
        else assignment.CategoryId = request.CategoryId;
        await db.SaveChangesAsync(cancellationToken); return Ok(new { customerId, categoryId = request.CategoryId });
    }

    [Authorize(Roles = "ADMIN")]
    [HttpGet("customer/{customerId:guid}")]
    public async Task<IActionResult> CustomerCategory(Guid customerId, CancellationToken cancellationToken)
    {
        var row = await db.CustomerCategoryAssignments.AsNoTracking().Where(x => x.CustomerId == customerId)
            .Join(db.CustomerCategories, a => a.CategoryId, c => c.Id, (a, c) => new { c.Id, c.Code, c.Name }).FirstOrDefaultAsync(cancellationToken);
        return row is null ? NotFound("Customer has no billing category.") : Ok(row);
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("prices")]
    public async Task<IActionResult> CreatePrice(CategoryPriceRequest request, CancellationToken cancellationToken)
    {
        if (!await db.CustomerCategories.AnyAsync(x => x.Id == request.CategoryId && x.IsActive, cancellationToken)) return NotFound("Billing category not found.");
        if (!request.FixedPrice.HasValue && !request.DiscountPercent.HasValue) return BadRequest("Fixed price or discount percentage is required.");
        if (request.FixedPrice < 0 || request.DiscountPercent < 0 || request.DiscountPercent > 100) return BadRequest("Price or discount is invalid.");
        var row = new CategoryPriceRule { CompanyId = request.CompanyId, CategoryId = request.CategoryId, ProductId = request.ProductId, ProductGroup = request.ProductGroup?.Trim(), FixedPrice = request.FixedPrice, DiscountPercent = request.DiscountPercent, ValidFrom = request.ValidFrom.Date, ValidTo = request.ValidTo.Date, Priority = request.Priority, IsActive = true };
        db.CategoryPriceRules.Add(row); await db.SaveChangesAsync(cancellationToken); return Ok(row);
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpGet("prices")]
    public async Task<IActionResult> Prices([FromQuery] Guid categoryId, [FromQuery] Guid? productId, CancellationToken cancellationToken)
    {
        var query = db.CategoryPriceRules.AsNoTracking().Where(x => x.CategoryId == categoryId && x.IsActive);
        if (productId.HasValue) query = query.Where(x => x.ProductId == productId || x.ProductId == null);
        return Ok(await query.OrderByDescending(x => x.ProductId.HasValue).ThenByDescending(x => x.Priority).ToListAsync(cancellationToken));
    }

    [Authorize]
    [HttpGet("effective-price")]
    public async Task<IActionResult> EffectivePrice([FromQuery] Guid productId, [FromQuery] Guid customerId, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == productId, cancellationToken);
        if (product is null) return NotFound("Product not found.");
        var assignment = await db.CustomerCategoryAssignments.AsNoTracking().FirstOrDefaultAsync(x => x.CustomerId == customerId, cancellationToken);
        if (assignment is null) return Ok(new { productId, customerId, billingCategoryId = (Guid?)null, billingCategory = (string?)null, basePrice = product.SellingPrice, finalPrice = product.SellingPrice, source = "STANDARD" });
        var today = DateTime.UtcNow.Date;
        var rule = await db.CategoryPriceRules.AsNoTracking().Where(x => x.CategoryId == assignment.CategoryId && (x.ProductId == productId || x.ProductId == null) && x.IsActive && x.ValidFrom <= today && x.ValidTo >= today).OrderByDescending(x => x.ProductId.HasValue).ThenByDescending(x => x.Priority).FirstOrDefaultAsync(cancellationToken);
        var category = await db.CustomerCategories.AsNoTracking().FirstAsync(x => x.Id == assignment.CategoryId, cancellationToken);
        var finalPrice = product.SellingPrice; var source = "STANDARD";
        if (rule is not null) { finalPrice = rule.FixedPrice ?? Math.Round(product.SellingPrice * (1m - (rule.DiscountPercent ?? 0m) / 100m), 2); source = "BILLING_CATEGORY"; }
        return Ok(new { productId, customerId, billingCategoryId = category.Id, billingCategory = category.Name, basePrice = product.SellingPrice, finalPrice, source });
    }

    private async Task EnsureDefaults(CancellationToken cancellationToken)
    {
        var existing = await db.CustomerCategories.Select(x => x.Code).ToListAsync(cancellationToken);
        foreach (var item in DefaultCategories)
        {
            var parts = item.Split('|', 2);
            if (existing.Contains(parts[0], StringComparer.OrdinalIgnoreCase)) continue;
            db.CustomerCategories.Add(new CustomerCategory { Code = parts[0], Name = parts[1], IsActive = true });
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    public sealed record CreateBillingCategoryRequest(Guid? CompanyId, string Code, string Name);
    public sealed record AssignBillingCategoryRequest(Guid CategoryId);
    public sealed record CategoryPriceRequest(Guid? CompanyId, Guid CategoryId, Guid? ProductId, string? ProductGroup, decimal? FixedPrice, decimal? DiscountPercent, DateTime ValidFrom, DateTime ValidTo, int Priority = 0);
}
