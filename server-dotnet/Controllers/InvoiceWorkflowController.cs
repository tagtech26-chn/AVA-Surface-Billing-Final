using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/invoice-workflow")]
public sealed class InvoiceWorkflowController(BillingDbContext db) : ControllerBase
{
    [HttpGet("workflow-user")]
    public async Task<ActionResult> ResolveWorkflowUser([FromQuery] string role, CancellationToken cancellationToken)
    {
        var normalized = role.Trim().ToUpperInvariant();
        if (normalized == "ACCOUNTS") normalized = "ACCOUNTANT";

        if (normalized is not "ACCOUNTANT" and not "WAREHOUSE" and not "BRANCH_MANAGER" and not "ADMIN")
            return BadRequest("Unsupported workflow role.");

        var user = await db.AppUsers.AsNoTracking()
            .Where(x => x.IsActive && x.Role == normalized)
            .OrderBy(x => x.UserName)
            .Select(x => new { x.Id, x.UserName, x.DisplayName, x.Role })
            .FirstOrDefaultAsync(cancellationToken);

        return user is null ? NotFound("No active workflow user is configured for this role.") : Ok(user);
    }

    [HttpGet("manager-pending")]
    public async Task<ActionResult<IEnumerable<Invoice>>> ManagerPending(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Where(x => x.WorkflowStatus == "MANAGER_APPROVAL_PENDING")
            .OrderBy(x => x.InvoiceDate)
            .ToListAsync(cancellationToken));

    [HttpPost("{invoiceId:guid}/approve-manager-discount")]
    public async Task<ActionResult> ApproveManagerDiscount(Guid invoiceId, ManagerApprovalRequest request, CancellationToken cancellationToken)
    {
        if (request.UserId == Guid.Empty)
            return BadRequest("Branch Manager user is required.");

        var manager = await db.AppUsers.FirstOrDefaultAsync(
            x => x.Id == request.UserId && x.IsActive && x.Role == "BRANCH_MANAGER",
            cancellationToken);
        if (manager is null)
            return BadRequest("Only an active Branch Manager can approve an additional discount.");

        if (request.DiscountPercent <= 0 || request.DiscountPercent > 100)
            return BadRequest("Approved additional discount must be greater than 0% and not exceed 100%.");
        if (string.IsNullOrWhiteSpace(request.Remarks))
            return BadRequest("Manager remarks are required.");

        var invoice = await db.Invoices
            .Include(x => x.Lines)
            .ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "MANAGER_APPROVAL_PENDING")
            return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");

        var originalLineBases = invoice.Lines
            .Select(line => new
            {
                Line = line,
                Base = Math.Max(0m, Math.Round((line.Quantity * line.UnitPrice) - line.DiscountAmount, 2, MidpointRounding.AwayFromZero))
            })
            .ToList();

        var baseAmount = originalLineBases.Sum(x => x.Base);
        if (baseAmount <= 0m)
            return BadRequest("Invoice has no taxable line value available for manager discount.");

        invoice.BranchManagerDiscountPercent = Math.Round(request.DiscountPercent, 2, MidpointRounding.AwayFromZero);
        invoice.BranchManagerDiscountAmount = Math.Round(baseAmount * invoice.BranchManagerDiscountPercent / 100m, 2, MidpointRounding.AwayFromZero);
        invoice.BranchManagerUserId = manager.Id;
        invoice.BranchManagerRemarks = request.Remarks.Trim();
        invoice.WorkflowStatus = "PAYMENT_PENDING";

        // Allocate the approved manager discount across lines proportionally so line-level
        // taxable/tax totals remain consistent with the invoice header and Tally export.
        var allocated = 0m;
        for (var index = 0; index < originalLineBases.Count; index++)
        {
            var item = originalLineBases[index];
            var isLast = index == originalLineBases.Count - 1;
            var managerDiscount = isLast
                ? Math.Round(invoice.BranchManagerDiscountAmount - allocated, 2, MidpointRounding.AwayFromZero)
                : Math.Round(invoice.BranchManagerDiscountAmount * item.Base / baseAmount, 2, MidpointRounding.AwayFromZero);
            managerDiscount = Math.Max(0m, Math.Min(managerDiscount, item.Base));
            allocated += managerDiscount;

            var taxable = Math.Max(0m, Math.Round(item.Base - managerDiscount, 2, MidpointRounding.AwayFromZero));
            var gstRate = Math.Max(0m, item.Line.Product?.GstRate ?? 0m);
            var tax = Math.Round(taxable * gstRate / 100m, 2, MidpointRounding.AwayFromZero);

            item.Line.TaxableAmount = taxable;
            if (invoice.IgstAmount > 0m)
            {
                item.Line.CgstAmount = 0m;
                item.Line.SgstAmount = 0m;
                item.Line.IgstAmount = tax;
            }
            else
            {
                item.Line.CgstAmount = Math.Round(tax / 2m, 2, MidpointRounding.AwayFromZero);
                item.Line.SgstAmount = Math.Round(tax - item.Line.CgstAmount, 2, MidpointRounding.AwayFromZero);
                item.Line.IgstAmount = 0m;
            }

            item.Line.LineTotal = Math.Round(
                item.Line.TaxableAmount + item.Line.CgstAmount + item.Line.SgstAmount + item.Line.IgstAmount,
                2,
                MidpointRounding.AwayFromZero);
        }

        // Rebuild the invoice header from the recalculated lines. Customer-facing UI should
        // expose only the combined Total Discount; manager-specific fields remain audit data.
        invoice.DiscountAmount = Math.Round(invoice.Lines.Sum(x => x.DiscountAmount), 2, MidpointRounding.AwayFromZero);
        invoice.PromoDiscountAmount = Math.Round(invoice.PromoDiscountAmount, 2, MidpointRounding.AwayFromZero);
        invoice.TaxableAmount = Math.Round(invoice.Lines.Sum(x => x.TaxableAmount), 2, MidpointRounding.AwayFromZero);
        invoice.CgstAmount = Math.Round(invoice.Lines.Sum(x => x.CgstAmount), 2, MidpointRounding.AwayFromZero);
        invoice.SgstAmount = Math.Round(invoice.Lines.Sum(x => x.SgstAmount), 2, MidpointRounding.AwayFromZero);
        invoice.IgstAmount = Math.Round(invoice.Lines.Sum(x => x.IgstAmount), 2, MidpointRounding.AwayFromZero);

        var revisedPreRound = Math.Round(invoice.TaxableAmount + invoice.CgstAmount + invoice.SgstAmount + invoice.IgstAmount, 2, MidpointRounding.AwayFromZero);
        const decimal roundTo = 5m;
        var roundedTotal = Math.Round(revisedPreRound / roundTo, 0, MidpointRounding.AwayFromZero) * roundTo;
        invoice.RoundOffAmount = Math.Round(roundedTotal - revisedPreRound, 2, MidpointRounding.AwayFromZero);
        invoice.GrandTotal = roundedTotal;

        db.AuditLogs.Add(new AuditLog
        {
            UserId = manager.Id,
            Action = "INVOICE_MANAGER_DISCOUNT_APPROVED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Additional discount {invoice.BranchManagerDiscountPercent:0.##}% approved. Remarks: {invoice.BranchManagerRemarks}",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    [HttpPost("{invoiceId:guid}/reject-manager-discount")]
    public async Task<ActionResult> RejectManagerDiscount(Guid invoiceId, ManagerRejectionRequest request, CancellationToken cancellationToken)
    {
        var manager = await db.AppUsers.FirstOrDefaultAsync(
            x => x.Id == request.UserId && x.IsActive && x.Role == "BRANCH_MANAGER",
            cancellationToken);
        if (manager is null) return BadRequest("Only an active Branch Manager can reject an additional discount request.");
        if (string.IsNullOrWhiteSpace(request.Remarks)) return BadRequest("Rejection remarks are required.");

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "MANAGER_APPROVAL_PENDING")
            return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");

        invoice.WorkflowStatus = "MANAGER_APPROVAL_REJECTED";
        invoice.BranchManagerUserId = manager.Id;
        invoice.BranchManagerDiscountPercent = 0m;
        invoice.BranchManagerDiscountAmount = 0m;
        invoice.BranchManagerRemarks = request.Remarks.Trim();

        db.AuditLogs.Add(new AuditLog
        {
            UserId = manager.Id,
            Action = "INVOICE_MANAGER_DISCOUNT_REJECTED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Additional discount request rejected. Remarks: {invoice.BranchManagerRemarks}",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    [HttpGet("pending-payments")]
    public async Task<ActionResult<IEnumerable<Invoice>>> PendingPayments(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Payments)
            .Where(x => x.WorkflowStatus == "PAYMENT_PENDING")
            .OrderBy(x => x.InvoiceDate)
            .ToListAsync(cancellationToken));

    [HttpGet("warehouse-ready")]
    public async Task<ActionResult<IEnumerable<Invoice>>> WarehouseReady(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Where(x => x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "WAREHOUSE_READY" || x.WorkflowStatus == "LOADED")
            .OrderBy(x => x.InvoiceDate)
            .ToListAsync(cancellationToken));

    [HttpPost("{invoiceId:guid}/confirm-payment")]
    public async Task<ActionResult> ConfirmPayment(Guid invoiceId, PaymentConfirmationRequest request, CancellationToken cancellationToken)
    {
        if (request.UserId == Guid.Empty)
            return BadRequest("Accounts user is required.");

        var accountsUser = await db.AppUsers.FirstOrDefaultAsync(
            x => x.Id == request.UserId && x.IsActive && (x.Role == "ACCOUNTANT" || x.Role == "ACCOUNTS"),
            cancellationToken);
        if (accountsUser is null)
            return BadRequest("Only an active Accounts user can confirm payment.");

        if (request.Amount <= 0)
            return BadRequest("Payment amount must be greater than zero.");
        if (string.IsNullOrWhiteSpace(request.Method))
            return BadRequest("Payment method is required.");

        var requestedMethod = request.Method.Trim().ToUpperInvariant();
        var allowedMethods = new[] { "CASH", "CARD", "UPI_QR", "BANK_TRANSFER" };
        if (!allowedMethods.Contains(requestedMethod, StringComparer.OrdinalIgnoreCase))
            return BadRequest("Payment method must be CASH, CARD, UPI_QR or BANK_TRANSFER.");

        var invoice = await db.Invoices.Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_PENDING")
            return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");

        if (!string.Equals(invoice.PaymentMethodRequested, requestedMethod, StringComparison.OrdinalIgnoreCase))
            return BadRequest($"Payment method mismatch. Cashier requested '{invoice.PaymentMethodRequested}', but Accounts submitted '{requestedMethod}'.");

        if (string.IsNullOrWhiteSpace(request.SpecificReference))
            return BadRequest("Payment-specific receipt/reference is required for Accounts confirmation.");

        if (requestedMethod == "CARD" && !System.Text.RegularExpressions.Regex.IsMatch(request.CardLast4 ?? string.Empty, "^\\d{4}$"))
            return BadRequest("Card last 4 digits are required for card payment.");

        if ((requestedMethod is "UPI_QR" or "BANK_TRANSFER") && string.IsNullOrWhiteSpace(request.Utr))
            return BadRequest("UTR / transaction ID is required for this payment method.");

        if (requestedMethod == "CASH" && string.IsNullOrWhiteSpace(request.SpecificReference))
            return BadRequest("Cash receipt/reference is required after cash collection by Accounts.");

        invoice.PaymentConfirmedByUserId = accountsUser.Id;
        invoice.PaymentConfirmedByName = accountsUser.DisplayName;
        invoice.PaymentConfirmedAtUtc = DateTime.UtcNow;
        invoice.PaymentMethodConfirmed = requestedMethod;
        invoice.PaymentSpecificReference = request.SpecificReference.Trim();
        invoice.PaymentBankName = string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim();
        invoice.PaymentCardLast4 = string.IsNullOrWhiteSpace(request.CardLast4) ? null : request.CardLast4.Trim();
        invoice.PaymentUtr = string.IsNullOrWhiteSpace(request.Utr) ? null : request.Utr.Trim();
        invoice.PaymentRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        invoice.WorkflowStatus = "PAYMENT_CONFIRMED";
        invoice.Status = request.Amount >= invoice.GrandTotal ? "PAID" : "PARTIAL";

        invoice.Payments.Add(new Payment
        {
            Id = Guid.NewGuid(), InvoiceId = invoice.Id, Amount = request.Amount,
            Method = requestedMethod,
            PaymentDateUtc = request.PaymentDateUtc == default ? DateTime.UtcNow : request.PaymentDateUtc,
            Reference = request.SpecificReference.Trim()
        });

        db.AuditLogs.Add(new AuditLog
        {
            UserId = accountsUser.Id, Action = "INVOICE_PAYMENT_CONFIRMED", EntityName = nameof(Invoice), EntityId = invoice.Id,
            Details = $"Accounts confirmed {requestedMethod} payment: amount {request.Amount:0.00}, reference {request.SpecificReference}.", CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    [HttpPost("{invoiceId:guid}/load")]
    public async Task<ActionResult> MarkLoaded(Guid invoiceId, WarehouseLoadRequest request, CancellationToken cancellationToken)
    {
        var warehouseUser = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == request.UserId && x.IsActive && x.Role == "WAREHOUSE", cancellationToken);
        if (warehouseUser is null) return BadRequest("Only an active Warehouse user can load an invoice.");
        if (string.IsNullOrWhiteSpace(request.LoadedBy) || string.IsNullOrWhiteSpace(request.VerifiedBy)) return BadRequest("Loaded By and Verified By are required.");

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_CONFIRMED" && invoice.WorkflowStatus != "WAREHOUSE_READY") return BadRequest("Invoice must have confirmed payment before warehouse loading.");

        invoice.WarehouseLoadedBy = request.LoadedBy.Trim();
        invoice.WarehouseVerifiedBy = request.VerifiedBy.Trim();
        invoice.WarehouseLoadedAtUtc = DateTime.UtcNow;
        invoice.WarehouseVehicleNumber = string.IsNullOrWhiteSpace(request.VehicleNumber) ? null : request.VehicleNumber.Trim();
        invoice.WarehouseRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        invoice.WorkflowStatus = "LOADED";

        db.AuditLogs.Add(new AuditLog
        {
            UserId = warehouseUser.Id, Action = "INVOICE_LOADED", EntityName = nameof(Invoice), EntityId = invoice.Id,
            Details = $"Loaded by {request.LoadedBy}; verified by {request.VerifiedBy}; vehicle {request.VehicleNumber}.", CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    [HttpPost("{invoiceId:guid}/deliver")]
    public async Task<ActionResult> MarkDelivered(Guid invoiceId, DeliveryConfirmationRequest request, CancellationToken cancellationToken)
    {
        var warehouseUser = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == request.UserId && x.IsActive && x.Role == "WAREHOUSE", cancellationToken);
        if (warehouseUser is null) return BadRequest("Only an active Warehouse user can mark delivery.");

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "LOADED") return BadRequest("Invoice must be loaded before it can be marked delivered.");

        invoice.DeliveredAtUtc = DateTime.UtcNow;
        invoice.DeliveredByName = string.IsNullOrWhiteSpace(request.DeliveredByName) ? warehouseUser.DisplayName : request.DeliveredByName.Trim();
        invoice.DeliveryRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        invoice.WorkflowStatus = "DELIVERED";

        db.AuditLogs.Add(new AuditLog
        {
            UserId = warehouseUser.Id, Action = "INVOICE_DELIVERED", EntityName = nameof(Invoice), EntityId = invoice.Id,
            Details = $"Delivered by {invoice.DeliveredByName}. Remarks: {request.Remarks}", CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    public sealed record ManagerApprovalRequest(Guid UserId, decimal DiscountPercent, string Remarks);
    public sealed record ManagerRejectionRequest(Guid UserId, string Remarks);
    public sealed record PaymentConfirmationRequest(Guid UserId, decimal Amount, string Method, string SpecificReference, string? BankName = null, string? CardLast4 = null, string? Utr = null, string? Remarks = null, DateTime PaymentDateUtc = default);
    public sealed record WarehouseLoadRequest(Guid UserId, string LoadedBy, string VerifiedBy, string? VehicleNumber = null, string? Remarks = null);
    public sealed record DeliveryConfirmationRequest(Guid UserId, string? DeliveredByName = null, string? Remarks = null);
}
