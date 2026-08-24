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
    private static readonly string[] DefaultCategories =
    {
        "RETAIL|Retail Sale",
        "WHOLESALE|Wholesale",
        "PROJECTS|Projects",
        "ENGINEERS_CONTRACTORS|Engineer & Contractors"
    };

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        await EnsureDefaults(ct);
        return Ok(await db.CustomerCategories.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Name)
            .Select(x => new { x.Id, x.Code, x.Name, x.CompanyId, x.IsActive })
            .ToListAsync(ct));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPost]
    public async Task<IActionResult> Create(CreateBillingCategoryRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Billing category code and name are required.");
        var code = request.Code.Trim().ToUpperInvariant();
        if (await db.CustomerCategories.AnyAsync(x => x.Code == code, ct)) return Conflict("A billing category with this code already exists.");
        var category = new CustomerCategory { CompanyId = request.CompanyId, Code = code, Name = request.Name.Trim(), IsActive = true };
        db.CustomerCategories.Add(category); await db.SaveChangesAsync(ct); return Ok(category);
    }

    [Authorize]
    [HttpGet("customers")]
    public async Task<IActionResult> Customers([FromQuery] Guid categoryId, [FromQuery] string? search = null, [FromQuery] int limit = 50, CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var term = search?.Trim();
        var query = db.CustomerCategoryAssignments.AsNoTracking()
            .Where(a => a.CategoryId == categoryId)
            .Join(db.Customers.AsNoTracking().Where(c => c.IsActive), a => a.CustomerId, c => c.Id, (a, c) => c);
        if (!string.IsNullOrWhiteSpace(term)) query = query.Where(c => c.Name.Contains(term) || c.Code.Contains(term) || (c.Phone != null && c.Phone.Contains(term)) || (c.Gstin != null && c.Gstin.Contains(term)));
        return Ok(await query.OrderBy(c => c.Name).Take(limit)
            .Select(c => new { c.Id, c.CompanyId, c.Code, c.Name, c.Phone, c.Email, c.Gstin, c.Address, c.BillingAddress, c.ShippingAddress, c.City, c.State, c.StateCode, c.CustomerType, c.IsActive })
            .ToListAsync(ct));
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPut("customer/{customerId:guid}")]
    public async Task<IActionResult> AssignCustomer(Guid customerId, AssignBillingCategoryRequest request, CancellationToken ct)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == customerId, ct)) return NotFound("Customer not found.");
        if (!await db.CustomerCategories.AnyAsync(x => x.Id == request.CategoryId && x.IsActive, ct)) return NotFound("Billing category not found.");
        var assignment = await db.CustomerCategoryAssignments.FirstOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (assignment is null) db.CustomerCategoryAssignments.Add(new CustomerCategoryAssignment { CustomerId = customerId, CategoryId = request.CategoryId }); else assignment.CategoryId = request.CategoryId;
        await db.SaveChangesAsync(ct); return Ok(new { customerId, categoryId = request.CategoryId });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpGet("customer/{customerId:guid}")]
    public async Task<IActionResult> CustomerCategory(Guid customerId, CancellationToken ct)
    {
        var row = await db.CustomerCategoryAssignments.AsNoTracking().Where(x => x.CustomerId == customerId).Join(db.CustomerCategories, a => a.CategoryId, c => c.Id, (a, c) => new { c.Id, c.Code, c.Name }).FirstOrDefaultAsync(ct);
        return row is null ? NotFound("Customer has no billing category.") : Ok(row);
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("prices")]
    public async Task<IActionResult> CreatePrice(CategoryPriceRequest request, CancellationToken ct)
    {
        if (!request.FixedPrice.HasValue && !request.DiscountPercent.HasValue) return BadRequest("Fixed price or discount percentage is required.");
        if (request.FixedPrice.HasValue && request.FixedPrice.Value < 0) return BadRequest("Fixed price cannot be negative.");
        if (request.DiscountPercent.HasValue && (request.DiscountPercent.Value < 0 || request.DiscountPercent.Value > 100)) return BadRequest("Discount percentage must be between 0 and 100.");
        if (request.ValidTo.Date < request.ValidFrom.Date) return BadRequest("Valid-to date cannot be earlier than valid-from date.");
        var category = await db.CustomerCategories.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.CategoryId && x.IsActive, ct);
        if (category is null) return NotFound("Billing category not found. Refresh the Billing Categories list and try again.");
        if (request.ProductId.HasValue && !await db.Products.AsNoTracking().AnyAsync(x => x.Id == request.ProductId.Value, ct)) return NotFound("Product not found.");
        var row = new CategoryPriceRule { CompanyId = request.CompanyId ?? category.CompanyId, CategoryId = request.CategoryId, ProductId = request.ProductId, ProductGroup = string.IsNullOrWhiteSpace(request.ProductGroup) ? null : request.ProductGroup.Trim(), FixedPrice = request.FixedPrice, DiscountPercent = request.DiscountPercent, ValidFrom = request.ValidFrom.Date, ValidTo = request.ValidTo.Date, Priority = request.Priority, IsActive = true };
        try { db.CategoryPriceRules.Add(row); await db.SaveChangesAsync(ct); } catch (DbUpdateException ex) { return Problem(title: "Unable to save category price", detail: ex.InnerException?.Message ?? ex.Message, statusCode: StatusCodes.Status500InternalServerError); }
        return Ok(row);
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpGet("prices")]
    public async Task<IActionResult> Prices([FromQuery] Guid categoryId, [FromQuery] Guid? productId, CancellationToken ct)
    {
        var q = db.CategoryPriceRules.AsNoTracking().Where(x => x.CategoryId == categoryId && x.IsActive);
        if (productId.HasValue) q = q.Where(x => x.ProductId == productId || x.ProductId == null);
        return Ok(await q.OrderByDescending(x => x.ProductId.HasValue).ThenByDescending(x => x.Priority).ToListAsync(ct));
    }

    [Authorize]
    [HttpGet("effective-price")]
    public async Task<IActionResult> EffectivePrice([FromQuery] Guid productId, [FromQuery] Guid customerId, CancellationToken ct)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == productId, ct); if (product is null) return NotFound("Product not found.");
        var assignment = await db.CustomerCategoryAssignments.AsNoTracking().FirstOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (assignment is null) return Ok(new { productId, customerId, billingCategoryId = (Guid?)null, billingCategory = (string?)null, basePrice = product.SellingPrice, finalPrice = product.SellingPrice, source = "STANDARD" });
        var today = DateTime.UtcNow.Date;
        var rule = await db.CategoryPriceRules.AsNoTracking().Where(x => x.CategoryId == assignment.CategoryId && (x.ProductId == productId || x.ProductId == null) && x.IsActive && x.ValidFrom <= today && x.ValidTo >= today).OrderByDescending(x => x.ProductId.HasValue).ThenByDescending(x => x.Priority).FirstOrDefaultAsync(ct);
        var category = await db.CustomerCategories.AsNoTracking().FirstAsync(x => x.Id == assignment.CategoryId, ct);
        var finalPrice = product.SellingPrice; var source = "STANDARD";
        if (rule is not null) { finalPrice = rule.FixedPrice ?? Math.Round(product.SellingPrice * (1m - (rule.DiscountPercent ?? 0m) / 100m), 2); source = "BILLING_CATEGORY"; }
        return Ok(new { productId, customerId, billingCategoryId = category.Id, billingCategory = category.Name, basePrice = product.SellingPrice, finalPrice, source });
    }

    private async Task EnsureDefaults(CancellationToken ct)
    {
        var existing = await db.CustomerCategories.Select(x => x.Code).ToListAsync(ct);
        foreach (var item in DefaultCategories)
        {
            var parts = item.Split('|', 2); if (existing.Contains(parts[0], StringComparer.OrdinalIgnoreCase)) continue;
            db.CustomerCategories.Add(new CustomerCategory { Code = parts[0], Name = parts[1], IsActive = true });
        }
        await db.SaveChangesAsync(ct);
    }

    public sealed record CreateBillingCategoryRequest(Guid? CompanyId, string Code, string Name);
    public sealed record AssignBillingCategoryRequest(Guid CategoryId);
    public sealed record CategoryPriceRequest(Guid? CompanyId, Guid CategoryId, Guid? ProductId, string? ProductGroup, decimal? FixedPrice, decimal? DiscountPercent, DateTime ValidFrom, DateTime ValidTo, int Priority = 0);
}
