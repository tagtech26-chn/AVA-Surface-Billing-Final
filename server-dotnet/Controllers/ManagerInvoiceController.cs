using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize(Roles = "MANAGER,BRANCH_MANAGER,ADMIN")]
[Route("api/manager/invoices")]
public sealed class ManagerInvoiceController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Invoice>>> GetAll(CancellationToken cancellationToken)
        => Ok(await QueryInvoices().OrderByDescending(x => x.InvoiceDate).ThenByDescending(x => x.CreatedAtUtc).ToListAsync(cancellationToken));

    [HttpGet("unpaid")]
    public async Task<ActionResult<IEnumerable<Invoice>>> GetUnpaid(CancellationToken cancellationToken)
        => Ok(await QueryInvoices().Where(x => x.WorkflowStatus != "PAYMENT_CONFIRMED" && x.WorkflowStatus != "COMPLETED" && x.Status != "PAID").OrderBy(x => x.InvoiceDate).ToListAsync(cancellationToken));

    [HttpGet("paid")]
    public async Task<ActionResult<IEnumerable<Invoice>>> GetPaid(CancellationToken cancellationToken)
        => Ok(await QueryInvoices().Where(x => x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "COMPLETED" || x.Status == "PAID").OrderByDescending(x => x.InvoiceDate).ToListAsync(cancellationToken));

    [HttpGet("{invoiceId:guid}")]
    public async Task<ActionResult> Get(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await QueryInvoices().FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpPost("{invoiceId:guid}/decision")]
    public async Task<ActionResult> SaveDecision(Guid invoiceId, ManagerDecisionRequest request, CancellationToken cancellationToken)
    {
        var managerId = GetAuthenticatedUserId();
        if (!managerId.HasValue) return Unauthorized();

        var manager = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == managerId.Value && x.IsActive && (x.Role == "MANAGER" || x.Role == "BRANCH_MANAGER" || x.Role == "ADMIN"), cancellationToken);
        if (manager is null) return Forbid();

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus == "PAYMENT_CONFIRMED" || invoice.WorkflowStatus == "COMPLETED" || invoice.Status == "PAID")
            return Conflict("Payment is already confirmed. Manager discount and credit note are locked.");

        if (request.AdditionalDiscountPercent < 0m || request.AdditionalDiscountPercent > 100m)
            return BadRequest("Additional discount must be between 0% and 100%.");
        if (request.CreditNoteAmount < 0m) return BadRequest("Credit note amount cannot be negative.");

        // Manager discount is the only value that changes the invoice's commercial value.
        // Credit note remains outside the invoice and only reduces Accounts collection.
        // Repeated manager saves must always start from the original commercial value,
        // not from an already-discounted GrandTotal.
        var originalCommercialValue = invoice.BranchManagerDiscountAmount > 0m
            ? invoice.GrandTotal + invoice.BranchManagerDiscountAmount
            : invoice.GrandTotal;
        originalCommercialValue = Math.Max(0m, Math.Round(originalCommercialValue, 2, MidpointRounding.AwayFromZero));

        var discountPercent = Math.Round(request.AdditionalDiscountPercent, 2, MidpointRounding.AwayFromZero);
        var discountAmount = Math.Round(originalCommercialValue * discountPercent / 100m, 2, MidpointRounding.AwayFromZero);
        if (discountAmount > originalCommercialValue) discountAmount = originalCommercialValue;

        var commercialValue = Math.Max(0m, Math.Round(originalCommercialValue - discountAmount, 2, MidpointRounding.AwayFromZero));
        var creditNoteAmount = Math.Round(request.CreditNoteAmount, 2, MidpointRounding.AwayFromZero);
        if (creditNoteAmount > commercialValue)
            return BadRequest($"Credit note amount cannot exceed the commercial invoice value of {commercialValue:0.00} after manager discount.");
        if (creditNoteAmount > 0m && string.IsNullOrWhiteSpace(request.CreditNoteReason))
            return BadRequest("Credit note reason is required when a credit note is flagged.");

        invoice.BranchManagerDiscountPercent = discountPercent;
        invoice.BranchManagerDiscountAmount = discountAmount;
        invoice.BranchManagerUserId = manager.Id;
        invoice.BranchManagerRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        invoice.CreditNoteFlagged = creditNoteAmount > 0m;
        invoice.CreditNoteAmount = creditNoteAmount;
        invoice.CreditNoteUserId = invoice.CreditNoteFlagged ? manager.Id : null;
        invoice.CreditNoteFlaggedAtUtc = invoice.CreditNoteFlagged ? DateTime.UtcNow : null;
        invoice.CreditNoteReason = invoice.CreditNoteFlagged ? request.CreditNoteReason!.Trim() : null;
        invoice.GrandTotal = commercialValue;
        invoice.WorkflowStatus = "PAYMENT_PENDING";
        invoice.Status = "UNPAID";

        db.AuditLogs.Add(new AuditLog
        {
            UserId = manager.Id,
            Action = "INVOICE_MANAGER_FINAL_DECISION",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Manager discount {invoice.BranchManagerDiscountPercent:0.##}% ({invoice.BranchManagerDiscountAmount:0.00}); credit note {invoice.CreditNoteAmount:0.00}; original commercial value {originalCommercialValue:0.00}; final commercial invoice value {invoice.GrandTotal:0.00}; Accounts collection {Math.Max(0m, invoice.GrandTotal - invoice.CreditNoteAmount):0.00}."
        });

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Manager decision could not be saved to the database.", detail = ex.InnerException?.Message ?? ex.Message });
        }

        return Ok(ToManagerDto(invoice));
    }

    private IQueryable<Invoice> QueryInvoices() => db.Invoices.AsNoTracking().Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Include(x => x.Payments);

    private static object ToManagerDto(Invoice invoice) => new
    {
        invoice.Id,
        invoice.InvoiceNumber,
        invoice.InvoiceDate,
        invoice.SubTotal,
        invoice.DiscountAmount,
        invoice.PromoDiscountAmount,
        invoice.BranchManagerDiscountPercent,
        invoice.BranchManagerDiscountAmount,
        invoice.CreditNoteFlagged,
        invoice.CreditNoteAmount,
        invoice.CreditNoteReason,
        invoice.GrandTotal,
        AmountToCollect = Math.Max(0m, invoice.GrandTotal - invoice.CreditNoteAmount),
        invoice.WorkflowStatus,
        invoice.Status,
        invoice.PaymentMethodRequested,
        invoice.PaymentConfirmedAtUtc,
        invoice.Customer,
        invoice.Salesperson,
        invoice.Lines,
        invoice.Payments
    };

    private Guid? GetAuthenticatedUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(value, out var userId) ? userId : null;
    }

    public sealed record ManagerDecisionRequest(Guid UserId, decimal AdditionalDiscountPercent, decimal CreditNoteAmount, string? CreditNoteReason = null, string? Remarks = null);
}
