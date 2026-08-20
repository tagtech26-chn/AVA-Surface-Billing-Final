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
        if (!managerId.HasValue || request.UserId != managerId.Value) return Forbid();

        var manager = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == managerId.Value && x.IsActive && (x.Role == "MANAGER" || x.Role == "BRANCH_MANAGER" || x.Role == "ADMIN"), cancellationToken);
        if (manager is null) return Forbid();

        var invoice = await db.Invoices.Include(x => x.Lines).ThenInclude(x => x.Product).FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus == "PAYMENT_CONFIRMED" || invoice.WorkflowStatus == "COMPLETED" || invoice.Status == "PAID")
            return Conflict("Payment is already confirmed. Manager discount and credit note are locked.");

        if (request.AdditionalDiscountPercent < 0m || request.AdditionalDiscountPercent > 100m)
            return BadRequest("Additional discount must be between 0% and 100%.");
        if (request.CreditNoteAmount < 0m) return BadRequest("Credit note amount cannot be negative.");
        if (request.CreditNoteAmount > invoice.GrandTotal) return BadRequest("Credit note cannot exceed the final commercial invoice value.");
        if (request.CreditNoteAmount > 0m && string.IsNullOrWhiteSpace(request.CreditNoteReason)) return BadRequest("Credit note reason is required when a credit note is flagged.");

        var bases = invoice.Lines.Select(line => new
        {
            Line = line,
            Base = Math.Max(0m, Math.Round((line.Quantity * line.UnitPrice) - line.DiscountAmount, 2, MidpointRounding.AwayFromZero))
        }).ToList();
        var baseAmount = bases.Sum(x => x.Base);
        if (baseAmount <= 0m) return BadRequest("Invoice has no line value available for manager discount.");

        var discountPercent = Math.Round(request.AdditionalDiscountPercent, 2, MidpointRounding.AwayFromZero);
        var discountAmount = Math.Round(baseAmount * discountPercent / 100m, 2, MidpointRounding.AwayFromZero);
        var allocated = 0m;
        foreach (var item in bases.Select((value, index) => new { value, index }))
        {
            var managerDiscount = item.index == bases.Count - 1
                ? Math.Round(discountAmount - allocated, 2, MidpointRounding.AwayFromZero)
                : Math.Round(discountAmount * item.value.Base / baseAmount, 2, MidpointRounding.AwayFromZero);
            managerDiscount = Math.Max(0m, Math.Min(managerDiscount, item.value.Base));
            allocated += managerDiscount;
            var taxable = Math.Max(0m, Math.Round(item.value.Base - managerDiscount, 2, MidpointRounding.AwayFromZero));
            var gstRate = Math.Max(0m, item.value.Line.Product?.GstRate ?? 0m);
            var tax = Math.Round(taxable * gstRate / 100m, 2, MidpointRounding.AwayFromZero);
            item.value.Line.TaxableAmount = taxable;
            if (invoice.IgstAmount > 0m) { item.value.Line.CgstAmount = 0m; item.value.Line.SgstAmount = 0m; item.value.Line.IgstAmount = tax; }
            else { item.value.Line.CgstAmount = Math.Round(tax / 2m, 2, MidpointRounding.AwayFromZero); item.value.Line.SgstAmount = Math.Round(tax - item.value.Line.CgstAmount, 2, MidpointRounding.AwayFromZero); item.value.Line.IgstAmount = 0m; }
            item.value.Line.LineTotal = Math.Round(item.value.Line.TaxableAmount + item.value.Line.CgstAmount + item.value.Line.SgstAmount + item.value.Line.IgstAmount, 2, MidpointRounding.AwayFromZero);
        }

        invoice.BranchManagerDiscountPercent = discountPercent;
        invoice.BranchManagerDiscountAmount = discountAmount;
        invoice.BranchManagerUserId = manager.Id;
        invoice.BranchManagerRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        invoice.CreditNoteFlagged = request.CreditNoteAmount > 0m;
        invoice.CreditNoteAmount = Math.Round(request.CreditNoteAmount, 2, MidpointRounding.AwayFromZero);
        invoice.CreditNoteUserId = invoice.CreditNoteFlagged ? manager.Id : null;
        invoice.CreditNoteFlaggedAtUtc = invoice.CreditNoteFlagged ? DateTime.UtcNow : null;
        invoice.CreditNoteReason = invoice.CreditNoteFlagged ? request.CreditNoteReason!.Trim() : null;

        invoice.DiscountAmount = Math.Round(invoice.Lines.Sum(x => x.DiscountAmount), 2, MidpointRounding.AwayFromZero);
        invoice.TaxableAmount = Math.Round(invoice.Lines.Sum(x => x.TaxableAmount), 2, MidpointRounding.AwayFromZero);
        invoice.CgstAmount = Math.Round(invoice.Lines.Sum(x => x.CgstAmount), 2, MidpointRounding.AwayFromZero);
        invoice.SgstAmount = Math.Round(invoice.Lines.Sum(x => x.SgstAmount), 2, MidpointRounding.AwayFromZero);
        invoice.IgstAmount = Math.Round(invoice.Lines.Sum(x => x.IgstAmount), 2, MidpointRounding.AwayFromZero);
        var preRound = Math.Round(invoice.TaxableAmount + invoice.CgstAmount + invoice.SgstAmount + invoice.IgstAmount, 2, MidpointRounding.AwayFromZero);
        var roundedTotal = Math.Round(preRound / 5m, 0, MidpointRounding.AwayFromZero) * 5m;
        invoice.RoundOffAmount = Math.Round(roundedTotal - preRound, 2, MidpointRounding.AwayFromZero);
        invoice.GrandTotal = roundedTotal;
        invoice.WorkflowStatus = "PAYMENT_PENDING";
        invoice.Status = "UNPAID";

        db.AuditLogs.Add(new AuditLog
        {
            UserId = manager.Id,
            Action = "INVOICE_MANAGER_FINAL_DECISION",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Manager discount {invoice.BranchManagerDiscountPercent:0.##}% ({invoice.BranchManagerDiscountAmount:0.00}); credit note {invoice.CreditNoteAmount:0.00}; final commercial invoice value {invoice.GrandTotal:0.00}."
        });
        await db.SaveChangesAsync(cancellationToken);
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