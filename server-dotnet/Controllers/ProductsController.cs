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
    public async Task<ActionResult<IEnumerable<Product>>> Get(CancellationToken cancellationToken)
        => Ok(await db.Products.AsNoTracking().OrderBy(x => x.Name).ToListAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Product>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpPost]
    public async Task<ActionResult<Product>> Create(Product product, CancellationToken cancellationToken)
    {
        if (product.CompanyId == Guid.Empty || string.IsNullOrWhiteSpace(product.Sku) || string.IsNullOrWhiteSpace(product.Name))
            return BadRequest("CompanyId, SKU and Name are required.");

        product.Id = Guid.NewGuid();
        db.Products.Add(product);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, Product input, CancellationToken cancellationToken)
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
        product.StockQuantity = input.StockQuantity;
        product.ReorderLevel = input.ReorderLevel;
        product.IsActive = input.IsActive;

        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
