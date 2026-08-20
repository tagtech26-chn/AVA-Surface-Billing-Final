using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/manager/invoices")]
public sealed class ManagerInvoiceListsController(BillingDbContext db) : ControllerBase
{
    [Authorize(Roles = "BRANCH_MANAGER,MANAGER,ADMIN")]
    [HttpGet("unapproved")]
    public async Task<ActionResult<IEnumerable<Invoice>>> Unapproved(CancellationToken ct) => Ok(await db.Invoices.AsNoTracking()
        .Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Include(x => x.Payments)
        .Where(x => x.WorkflowStatus == "MANAGER_APPROVAL_PENDING" || x.WorkflowStatus == "MANAGER_APPROVAL_REJECTED")
        .OrderBy(x => x.InvoiceDate).ToListAsync(ct));

    [Authorize(Roles = "BRANCH_MANAGER,MANAGER,ADMIN")]
    [HttpGet("approved")]
    public async Task<ActionResult<IEnumerable<Invoice>>> Approved(CancellationToken ct) => Ok(await db.Invoices.AsNoTracking()
        .Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Include(x => x.Payments)
        .Where(x => x.WorkflowStatus == "PAYMENT_PENDING" || x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "WAREHOUSE_READY" || x.WorkflowStatus == "COMPLETED")
        .OrderByDescending(x => x.InvoiceDate).ToListAsync(ct));
}

[ApiController]
[Authorize]
[Route("api/accounts/invoices")]
public sealed class AccountsInvoiceListsController(BillingDbContext db) : ControllerBase
{
    [Authorize(Roles = "ACCOUNTANT,ACCOUNTS,ADMIN")]
    [HttpGet("unapproved")]
    public async Task<ActionResult<IEnumerable<Invoice>>> Unapproved(CancellationToken ct) => Ok(await db.Invoices.AsNoTracking()
        .Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Include(x => x.Payments)
        .Where(x => x.WorkflowStatus == "MANAGER_APPROVAL_PENDING" || x.WorkflowStatus == "MANAGER_APPROVAL_REJECTED")
        .OrderBy(x => x.InvoiceDate).ToListAsync(ct));

    [Authorize(Roles = "ACCOUNTANT,ACCOUNTS,ADMIN")]
    [HttpGet("approved")]
    public async Task<ActionResult<IEnumerable<Invoice>>> Approved(CancellationToken ct) => Ok(await db.Invoices.AsNoTracking()
        .Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Include(x => x.Payments)
        .Where(x => x.WorkflowStatus == "PAYMENT_PENDING" || x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "WAREHOUSE_READY" || x.WorkflowStatus == "COMPLETED")
        .OrderByDescending(x => x.InvoiceDate).ToListAsync(ct));
}
