using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public sealed class InvoiceHistoryController(BillingDbContext db) : ControllerBase
{
    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<Invoice>>> GetHistory(CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Include(x => x.Payments)
            .OrderByDescending(x => x.InvoiceDate)
            .ToListAsync(cancellationToken);

        return Ok(invoices);
    }
}
