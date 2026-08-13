using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductDto>>> Get(CancellationToken cancellationToken)
    {
        var products = await db.Products.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return Ok(products.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ProductDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return product is null ? NotFound() : Ok(ToDto(product));
    }

    [HttpPost]
    public async Task<ActionResult<ProductDto>> Create(ProductRequest input, CancellationToken cancellationToken)
    {
        var companyId = await ResolveCompanyId(input.CompanyId, cancellationToken);
        if (companyId is null || string.IsNullOrWhiteSpace(input.Sku) || string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("A company, SKU and product name are required.");

        if (await db.Products.AnyAsync(x => x.CompanyId == companyId && x.Sku == input.Sku, cancellationToken))
            return Conflict("A product with this SKU already exists for the company.");

        var product = FromRequest(input, companyId.Value);
        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, ToDto(product));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ProductRequest input, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null) return NotFound();

        product.Sku = input.Sku;
        product.Name = input.Name;
        product.HsnCode = input.HsnCode;
        product.Unit = input.Unit;
        product.CostPrice = input.CostPrice;
        product.SellingPrice = input.SellingPrice;
        product.GstRate = input.GstRate;
        product.StockQuantity = input.Stock;
        product.ReorderLevel = input.ReorderLevel;
        product.IsActive = input.IsActive;

        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    // Compatibility endpoint used by the existing React Storage layer during migration.
    // It preserves the current UI and bulk state model while making SQL Server authoritative.
    [HttpPut("sync")]
    public async Task<ActionResult<IEnumerable<ProductDto>>> Sync(IEnumerable<ProductSyncItem> input, CancellationToken cancellationToken)
    {
        var items = input.ToList();
        var companyId = await ResolveCompanyId(null, cancellationToken);
        if (companyId is null) return BadRequest("No active company is configured.");

        foreach (var item in items.Where(x => !string.IsNullOrWhiteSpace(x.Sku) && !string.IsNullOrWhiteSpace(x.Name)))
        {
            var product = await db.Products.FirstOrDefaultAsync(x => x.Id == item.Id && x.CompanyId == companyId, cancellationToken)
                ?? await db.Products.FirstOrDefaultAsync(x => x.CompanyId == companyId && x.Sku == item.Sku, cancellationToken);

            if (product is null)
            {
                product = new Product { Id = item.Id == Guid.Empty ? Guid.NewGuid() : item.Id, CompanyId = companyId.Value };
                db.Products.Add(product);
            }

            product.Sku = item.Sku;
            product.Name = item.Name;
            product.HsnCode = item.HsnCode;
            product.Unit = item.Unit ?? "PCS";
            product.CostPrice = item.CostPrice;
            product.SellingPrice = item.SellingPrice;
            product.GstRate = item.TaxRate;
            product.StockQuantity = item.Stock;
            product.ReorderLevel = item.ReorderLevel;
            product.IsActive = true;
        }

        await db.SaveChangesAsync(cancellationToken);
        return Ok((await db.Products.AsNoTracking().Where(x => x.CompanyId == companyId).OrderBy(x => x.Name).ToListAsync(cancellationToken)).Select(ToDto));
    }

    private async Task<Guid?> ResolveCompanyId(Guid? requestedCompanyId, CancellationToken cancellationToken)
    {
        if (requestedCompanyId.HasValue && requestedCompanyId.Value != Guid.Empty)
            return await db.Companies.AnyAsync(x => x.Id == requestedCompanyId.Value, cancellationToken) ? requestedCompanyId : null;

        var existing = await db.Companies.OrderBy(x => x.CreatedAtUtc).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(cancellationToken);
        if (existing.HasValue) return existing;

        var company = new Company { Code = "DEFAULT", LegalName = "AVASurface Billing", IsActive = true };
        db.Companies.Add(company);
        await db.SaveChangesAsync(cancellationToken);
        return company.Id;
    }

    private static Product FromRequest(ProductRequest input, Guid companyId) => new()
    {
        CompanyId = companyId,
        Sku = input.Sku.Trim(),
        Name = input.Name.Trim(),
        HsnCode = input.HsnCode,
        Unit = input.Unit ?? "PCS",
        CostPrice = input.CostPrice,
        SellingPrice = input.SellingPrice,
        GstRate = input.GstRate,
        StockQuantity = input.Stock,
        ReorderLevel = input.ReorderLevel,
        IsActive = input.IsActive
    };

    private static ProductDto ToDto(Product product) => new(
        product.Id,
        product.Sku,
        product.Name,
        product.HsnCode,
        product.Unit,
        product.CostPrice,
        product.SellingPrice,
        product.StockQuantity,
        product.ReorderLevel,
        product.GstRate,
        product.IsActive);

    public sealed record ProductRequest(
        Guid? CompanyId,
        string Sku,
        string Name,
        string? HsnCode,
        string? Unit,
        decimal CostPrice,
        decimal SellingPrice,
        decimal Stock,
        decimal ReorderLevel,
        decimal GstRate,
        bool IsActive = true);

    public sealed record ProductSyncItem(
        Guid Id,
        string Sku,
        string Name,
        string? HsnCode,
        string? Unit,
        decimal CostPrice,
        decimal SellingPrice,
        decimal Stock,
        decimal ReorderLevel,
        decimal TaxRate);

    public sealed record ProductDto(
        Guid Id,
        string Sku,
        string Name,
        string? HsnCode,
        string Unit,
        decimal CostPrice,
        decimal SellingPrice,
        decimal Stock,
        decimal ReorderLevel,
        decimal TaxRate,
        bool IsActive);
}
