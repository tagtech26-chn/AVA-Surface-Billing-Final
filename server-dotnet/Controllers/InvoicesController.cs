using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/invoices")]
public sealed class InvoicesController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Invoice>>> Get(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking().Include(x => x.Customer).Include(x => x.Lines).ThenInclude(x => x.Product)
            .OrderByDescending(x => x.InvoiceDate).ToListAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Invoice>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost]
    public async Task<ActionResult<Invoice>> Create(Invoice invoice, CancellationToken cancellationToken)
    {
        if (invoice.CompanyId == Guid.Empty || string.IsNullOrWhiteSpace(invoice.InvoiceNumber) || invoice.Lines.Count == 0)
            return BadRequest("CompanyId, InvoiceNumber and at least one invoice line are required.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            invoice.Id = Guid.NewGuid();
            invoice.CreatedAtUtc = DateTime.UtcNow;
            invoice.InvoiceDate = invoice.InvoiceDate == default ? DateTime.UtcNow : invoice.InvoiceDate;

            foreach (var line in invoice.Lines)
            {
                line.Id = Guid.NewGuid();
                line.InvoiceId = invoice.Id;
            }

            // Inventory and accounting rules will be centralized in the application layer next.
            db.Invoices.Add(invoice);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
