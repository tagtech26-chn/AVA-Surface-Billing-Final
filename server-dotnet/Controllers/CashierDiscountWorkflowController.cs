using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/invoice-workflow")]
public sealed class CashierDiscountWorkflowController(BillingDbContext db) : ControllerBase
{
    [HttpGet("cashier-discount-candidates")]
    public async Task<ActionResult> Candidates(CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Where(x => x.WorkflowStatus == "PAYMENT_PENDING" || x.WorkflowStatus == "MANAGER_APPROVAL_REJECTED")
            .OrderByDescending(x => x.InvoiceDate)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDate,
                x.GrandTotal,
                x.WorkflowStatus,
                x.BranchManagerRemarks,
                Customer = x.Customer == null ? null : new { x.Customer.Name, x.Customer.Phone },
                SalespersonName = x.Salesperson == null ? null : x.Salesperson.Name
            })
            .ToListAsync(cancellationToken);

        return Ok(invoices);
    }

    [HttpPost("{invoiceId:guid}/request-manager-discount")]
    public async Task<ActionResult> RequestManagerDiscount(Guid invoiceId, CashierDiscountRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RequestedByName))
            return BadRequest("Cashier name is required.");

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();

        if (invoice.WorkflowStatus != "PAYMENT_PENDING" && invoice.WorkflowStatus != "MANAGER_APPROVAL_REJECTED")
            return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");

        invoice.WorkflowStatus = "MANAGER_APPROVAL_PENDING";
        invoice.BranchManagerDiscountPercent = 0m;
        invoice.BranchManagerDiscountAmount = 0m;
        invoice.BranchManagerRemarks = string.IsNullOrWhiteSpace(request.Remarks)
            ? $"Additional discount requested by cashier {request.RequestedByName.Trim()}."
            : $"Requested by cashier {request.RequestedByName.Trim()}: {request.Remarks.Trim()}";

        db.AuditLogs.Add(new AuditLog
        {
            Action = "INVOICE_MANAGER_DISCOUNT_REQUESTED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = invoice.BranchManagerRemarks,
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    public sealed record CashierDiscountRequest(string RequestedByName, string? Remarks = null);
}
