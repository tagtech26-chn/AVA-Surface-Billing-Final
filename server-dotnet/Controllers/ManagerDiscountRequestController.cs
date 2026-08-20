using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize(Roles = "CASHIER,BILLING_USER")]
[Route("api/invoice-workflow")]
public sealed class ManagerDiscountRequestController(BillingDbContext db) : ControllerBase
{
    [HttpGet("cashier-discount-candidates")]
    public async Task<ActionResult> CashierDiscountCandidates(CancellationToken cancellationToken)
    {
        var invoices = await db.Invoices
            .AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Where(x => x.WorkflowStatus == "PAYMENT_PENDING" || x.WorkflowStatus == "MANAGER_APPROVAL_REJECTED")
            .OrderByDescending(x => x.InvoiceDate)
            .Take(100)
            .Select(x => new
            {
                x.Id,
                x.InvoiceNumber,
                x.InvoiceDate,
                x.GrandTotal,
                x.WorkflowStatus,
                x.BranchManagerRemarks,
                customer = x.Customer == null ? null : new { x.Customer.Name, x.Customer.Phone },
                x.SalespersonName
            })
            .ToListAsync(cancellationToken);

        return Ok(invoices);
    }

    [HttpPost("{invoiceId:guid}/request-manager-discount")]
    public async Task<ActionResult> RequestManagerDiscount(Guid invoiceId, ManagerDiscountRequest request, CancellationToken cancellationToken)
    {
        var userId = GetAuthenticatedUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await db.AppUsers.FirstOrDefaultAsync(
            x => x.Id == userId.Value && x.IsActive && (x.Role == "CASHIER" || x.Role == "BILLING_USER"),
            cancellationToken);
        if (user is null) return Forbid();

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound("Invoice not found.");

        if (invoice.WorkflowStatus != "PAYMENT_PENDING" && invoice.WorkflowStatus != "MANAGER_APPROVAL_REJECTED")
            return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}' and cannot be sent for manager discount approval.");

        invoice.WorkflowStatus = "MANAGER_APPROVAL_PENDING";
        invoice.BranchManagerDiscountPercent = 0m;
        invoice.BranchManagerDiscountAmount = 0m;
        invoice.BranchManagerUserId = null;
        var remarks = string.IsNullOrWhiteSpace(request.Remarks) ? request.Reason : request.Remarks;
        invoice.BranchManagerRemarks = string.IsNullOrWhiteSpace(remarks) ? null : remarks.Trim();

        db.AuditLogs.Add(new AuditLog
        {
            UserId = user.Id,
            Action = "INVOICE_MANAGER_DISCOUNT_REQUESTED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Additional discount requested by {user.DisplayName}. Remarks: {invoice.BranchManagerRemarks ?? "None"}"
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    private Guid? GetAuthenticatedUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    public sealed record ManagerDiscountRequest(string? RequestedByName, string? Remarks = null, string? Reason = null);
}
