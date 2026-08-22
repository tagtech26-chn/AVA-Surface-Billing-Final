using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
[Route("api/enterprise/inventory")]
public sealed class EnterpriseInventoryController(BillingDbContext db) : ControllerBase
{
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, InventoryManagementRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Sku) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("SKU and product name are required.");
        if (request.Stock < 0 || request.ReorderLevel < 0)
            return BadRequest("Stock and reorder level cannot be negative.");

        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null) return NotFound("Product not found.");

        product.Sku = request.Sku.Trim();
        product.Name = request.Name.Trim();
        product.HsnCode = string.IsNullOrWhiteSpace(request.HsnCode) ? null : request.HsnCode.Trim();
        product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? "PCS" : request.Unit.Trim();
        product.CostPrice = request.CostPrice;
        product.SellingPrice = request.SellingPrice;
        product.GstRate = request.GstRate;
        product.StockQuantity = request.Stock;
        product.ReorderLevel = request.ReorderLevel;
        product.IsActive = request.IsActive;
        product.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        return Ok(new
        {
            product.Id,
            product.Sku,
            product.Name,
            product.HsnCode,
            product.Unit,
            product.CostPrice,
            product.SellingPrice,
            stock = product.StockQuantity,
            product.ReorderLevel,
            taxRate = product.GstRate,
            product.IsActive
        });
    }

    [HttpPost("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null) return NotFound("Product not found.");
        product.IsActive = false;
        product.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { product.Id, product.IsActive });
    }

    [HttpPost("{id:guid}/activate")]
    public async Task<IActionResult> Activate(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null) return NotFound("Product not found.");
        product.IsActive = true;
        product.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { product.Id, product.IsActive });
    }

    public sealed record InventoryManagementRequest(
        string Sku,
        string Name,
        string? HsnCode,
        string? Unit,
        decimal CostPrice,
        decimal SellingPrice,
        decimal GstRate,
        decimal Stock,
        decimal ReorderLevel,
        bool IsActive = true);
}
