using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize(Roles = "MANAGER,BRANCH_MANAGER,ADMIN")]
[Route("api/manager/invoices")]
public sealed class ManagerInvoiceWorkflowAliasesController(BillingDbContext db) : ControllerBase
{
    [HttpGet("unpaid")]
    public async Task<ActionResult<IEnumerable<Invoice>>> GetUnpaid(CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Include(x => x.Payments)
            .Where(x => x.WorkflowStatus != "PAYMENT_CONFIRMED" && x.WorkflowStatus != "COMPLETED" && x.Status != "PAID")
            .OrderBy(x => x.InvoiceDate)
            .ThenBy(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return Ok(invoices);
    }

    [HttpGet("paid")]
    public async Task<ActionResult<IEnumerable<Invoice>>> GetPaid(CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Include(x => x.Payments)
            .Where(x => x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "COMPLETED" || x.Status == "PAID")
            .OrderByDescending(x => x.InvoiceDate)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return Ok(invoices);
    }
}
