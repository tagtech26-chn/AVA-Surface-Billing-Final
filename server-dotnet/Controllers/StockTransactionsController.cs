using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/stock/transactions")]
public sealed class StockTransactionsController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<StockTransactionDto>>> Get(CancellationToken cancellationToken = default)
    {
        var rows = await db.StockTransactions
            .AsNoTracking()
            .Include(x => x.Product)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new StockTransactionDto(
                x.Id,
                x.ProductId,
                x.Product.Name,
                x.QuantityChange,
                x.TransactionType,
                x.ReferenceId,
                x.CreatedAtUtc,
                x.Notes))
            .Take(500)
            .ToListAsync(cancellationToken);

        return Ok(rows);
    }

    [HttpPost]
    public async Task<ActionResult<StockTransactionDto>> Create(StockTransactionRequest input, CancellationToken cancellationToken = default)
    {
        if (input.ProductId == Guid.Empty || input.QuantityChange == 0 || string.IsNullOrWhiteSpace(input.TransactionType))
            return BadRequest("Product, non-zero quantity change and transaction type are required.");

        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == input.ProductId, cancellationToken);
        if (product is null) return NotFound("Product not found.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        product.StockQuantity += input.QuantityChange;
        product.UpdatedAtUtc = DateTime.UtcNow;

        var stockTransaction = new StockTransaction
        {
            ProductId = input.ProductId,
            QuantityChange = input.QuantityChange,
            TransactionType = input.TransactionType.Trim().ToUpperInvariant(),
            ReferenceId = input.ReferenceId,
            Notes = input.Notes
        };

        db.StockTransactions.Add(stockTransaction);
        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new StockTransactionDto(
            stockTransaction.Id,
            stockTransaction.ProductId,
            product.Name,
            stockTransaction.QuantityChange,
            stockTransaction.TransactionType,
            stockTransaction.ReferenceId,
            stockTransaction.CreatedAtUtc,
            stockTransaction.Notes));
    }

    public sealed record StockTransactionRequest(Guid ProductId, decimal QuantityChange, string TransactionType, Guid? ReferenceId = null, string? Notes = null);
    public sealed record StockTransactionDto(Guid Id, Guid ProductId, string ProductName, decimal QuantityChange, string TransactionType, Guid? ReferenceId, DateTime CreatedAtUtc, string? Notes);
}
