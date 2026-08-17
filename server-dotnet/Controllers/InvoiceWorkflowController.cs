using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/invoice-workflow")]
public sealed class InvoiceWorkflowController(BillingDbContext db) : ControllerBase
{
    [HttpGet("workflow-user")]
    public async Task<ActionResult> ResolveWorkflowUser([FromQuery] string role, CancellationToken cancellationToken)
    {
        var normalized = role.Trim().ToUpperInvariant();
        if (normalized == "ACCOUNTS") normalized = "ACCOUNTANT";
        if (normalized is not "ACCOUNTANT" and not "WAREHOUSE" and not "BRANCH_MANAGER" and not "ADMIN") return BadRequest("Unsupported workflow role.");
        var user = await db.AppUsers.AsNoTracking().Where(x => x.IsActive && x.Role == normalized).OrderBy(x => x.UserName).Select(x => new { x.Id, x.UserName, x.DisplayName, x.Role }).FirstOrDefaultAsync(cancellationToken);
        return user is null ? NotFound("No active workflow user is configured for this role.") : Ok(user);
    }

    [Authorize(Roles = "BRANCH_MANAGER,ADMIN")]
    [HttpGet("manager-pending")]
    public async Task<ActionResult<IEnumerable<Invoice>>> ManagerPending(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking().Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Where(x => x.WorkflowStatus == "MANAGER_APPROVAL_PENDING").OrderBy(x => x.InvoiceDate).ToListAsync(cancellationToken));

    [Authorize(Roles = "BRANCH_MANAGER")]
    [HttpPost("{invoiceId:guid}/approve-manager-discount")]
    public async Task<ActionResult> ApproveManagerDiscount(Guid invoiceId, ManagerApprovalRequest request, CancellationToken cancellationToken)
    {
        var managerId = GetAuthenticatedUserId();
        if (!managerId.HasValue || request.UserId != managerId.Value) return Forbid();
        var manager = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == managerId.Value && x.IsActive && x.Role == "BRANCH_MANAGER", cancellationToken);
        if (manager is null) return BadRequest("Only an active Branch Manager can approve an additional discount.");
        if (request.DiscountPercent <= 0 || request.DiscountPercent > 100) return BadRequest("Approved additional discount must be greater than 0% and not exceed 100%.");
        if (string.IsNullOrWhiteSpace(request.Remarks)) return BadRequest("Manager remarks are required.");
        var invoice = await db.Invoices.Include(x => x.Lines).ThenInclude(x => x.Product).FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "MANAGER_APPROVAL_PENDING") return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");
        var bases = invoice.Lines.Select(line => new { Line = line, Base = Math.Max(0m, Math.Round((line.Quantity * line.UnitPrice) - line.DiscountAmount, 2, MidpointRounding.AwayFromZero)) }).ToList();
        var baseAmount = bases.Sum(x => x.Base);
        if (baseAmount <= 0m) return BadRequest("Invoice has no taxable line value available for manager discount.");
        invoice.BranchManagerDiscountPercent = Math.Round(request.DiscountPercent, 2, MidpointRounding.AwayFromZero);
        invoice.BranchManagerDiscountAmount = Math.Round(baseAmount * invoice.BranchManagerDiscountPercent / 100m, 2, MidpointRounding.AwayFromZero);
        invoice.BranchManagerUserId = manager.Id;
        invoice.BranchManagerRemarks = request.Remarks.Trim();
        invoice.WorkflowStatus = "PAYMENT_PENDING";
        var allocated = 0m;
        for (var i = 0; i < bases.Count; i++)
        {
            var item = bases[i];
            var managerDiscount = i == bases.Count - 1 ? Math.Round(invoice.BranchManagerDiscountAmount - allocated, 2, MidpointRounding.AwayFromZero) : Math.Round(invoice.BranchManagerDiscountAmount * item.Base / baseAmount, 2, MidpointRounding.AwayFromZero);
            managerDiscount = Math.Max(0m, Math.Min(managerDiscount, item.Base)); allocated += managerDiscount;
            var taxable = Math.Max(0m, Math.Round(item.Base - managerDiscount, 2, MidpointRounding.AwayFromZero));
            var gstRate = Math.Max(0m, item.Line.Product?.GstRate ?? 0m); var tax = Math.Round(taxable * gstRate / 100m, 2, MidpointRounding.AwayFromZero);
            item.Line.TaxableAmount = taxable;
            if (invoice.IgstAmount > 0m) { item.Line.CgstAmount = 0m; item.Line.SgstAmount = 0m; item.Line.IgstAmount = tax; } else { item.Line.CgstAmount = Math.Round(tax / 2m, 2, MidpointRounding.AwayFromZero); item.Line.SgstAmount = Math.Round(tax - item.Line.CgstAmount, 2, MidpointRounding.AwayFromZero); item.Line.IgstAmount = 0m; }
            item.Line.LineTotal = Math.Round(item.Line.TaxableAmount + item.Line.CgstAmount + item.Line.SgstAmount + item.Line.IgstAmount, 2, MidpointRounding.AwayFromZero);
        }
        invoice.DiscountAmount = Math.Round(invoice.Lines.Sum(x => x.DiscountAmount), 2, MidpointRounding.AwayFromZero);
        invoice.TaxableAmount = Math.Round(invoice.Lines.Sum(x => x.TaxableAmount), 2, MidpointRounding.AwayFromZero); invoice.CgstAmount = Math.Round(invoice.Lines.Sum(x => x.CgstAmount), 2, MidpointRounding.AwayFromZero); invoice.SgstAmount = Math.Round(invoice.Lines.Sum(x => x.SgstAmount), 2, MidpointRounding.AwayFromZero); invoice.IgstAmount = Math.Round(invoice.Lines.Sum(x => x.IgstAmount), 2, MidpointRounding.AwayFromZero);
        var preRound = Math.Round(invoice.TaxableAmount + invoice.CgstAmount + invoice.SgstAmount + invoice.IgstAmount, 2, MidpointRounding.AwayFromZero); var roundedTotal = Math.Round(preRound / 5m, 0, MidpointRounding.AwayFromZero) * 5m; invoice.RoundOffAmount = Math.Round(roundedTotal - preRound, 2, MidpointRounding.AwayFromZero); invoice.GrandTotal = roundedTotal;
        db.AuditLogs.Add(new AuditLog { UserId = manager.Id, Action = "INVOICE_MANAGER_DISCOUNT_APPROVED", EntityName = nameof(Invoice), EntityId = invoice.Id, Details = $"Additional discount {invoice.BranchManagerDiscountPercent:0.##}% approved. Remarks: {invoice.BranchManagerRemarks}", CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(cancellationToken); return Ok(invoice);
    }

    [Authorize(Roles = "BRANCH_MANAGER")]
    [HttpPost("{invoiceId:guid}/reject-manager-discount")]
    public async Task<ActionResult> RejectManagerDiscount(Guid invoiceId, ManagerRejectionRequest request, CancellationToken cancellationToken)
    {
        var managerId = GetAuthenticatedUserId(); if (!managerId.HasValue || request.UserId != managerId.Value) return Forbid();
        var manager = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == managerId.Value && x.IsActive && x.Role == "BRANCH_MANAGER", cancellationToken); if (manager is null) return BadRequest("Only an active Branch Manager can reject an additional discount request.");
        if (string.IsNullOrWhiteSpace(request.Remarks)) return BadRequest("Rejection remarks are required.");
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken); if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "MANAGER_APPROVAL_PENDING") return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");
        invoice.WorkflowStatus = "MANAGER_APPROVAL_REJECTED"; invoice.BranchManagerUserId = manager.Id; invoice.BranchManagerDiscountPercent = 0m; invoice.BranchManagerDiscountAmount = 0m; invoice.BranchManagerRemarks = request.Remarks.Trim();
        db.AuditLogs.Add(new AuditLog { UserId = manager.Id, Action = "INVOICE_MANAGER_DISCOUNT_REJECTED", EntityName = nameof(Invoice), EntityId = invoice.Id, Details = $"Additional discount request rejected. Remarks: {invoice.BranchManagerRemarks}", CreatedAtUtc = DateTime.UtcNow }); await db.SaveChangesAsync(cancellationToken); return Ok(invoice);
    }

    [Authorize(Roles = "ACCOUNTANT,ACCOUNTS,ADMIN")]
    [HttpGet("pending-payments")]
    public async Task<ActionResult<IEnumerable<Invoice>>> PendingPayments(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking().Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Payments).Where(x => x.WorkflowStatus == "PAYMENT_PENDING").OrderBy(x => x.InvoiceDate).ToListAsync(cancellationToken));

    [Authorize(Roles = "WAREHOUSE,ADMIN")]
    [HttpGet("warehouse-ready")]
    public async Task<ActionResult<IEnumerable<Invoice>>> WarehouseReady(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking().Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Where(x => x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "WAREHOUSE_READY").OrderBy(x => x.InvoiceDate).ToListAsync(cancellationToken));

    [Authorize(Roles = "ACCOUNTANT,ACCOUNTS")]
    [HttpPost("{invoiceId:guid}/confirm-payment")]
    public async Task<ActionResult> ConfirmPayment(Guid invoiceId, PaymentConfirmationRequest request, CancellationToken cancellationToken)
    {
        var accountsId = GetAuthenticatedUserId(); if (!accountsId.HasValue || request.UserId != accountsId.Value) return Forbid();
        var accountsUser = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == accountsId.Value && x.IsActive && (x.Role == "ACCOUNTANT" || x.Role == "ACCOUNTS"), cancellationToken); if (accountsUser is null) return BadRequest("Only an active Accounts user can confirm payment.");
        if (request.Amount <= 0) return BadRequest("Payment amount must be greater than zero.");
        var requestedMethod = request.Method.Trim().ToUpperInvariant(); if (!new[] { "CASH", "CARD", "UPI_QR", "BANK_TRANSFER" }.Contains(requestedMethod)) return BadRequest("Invalid payment method.");
        if (string.IsNullOrWhiteSpace(request.SpecificReference)) return BadRequest("Payment-specific receipt/reference is required.");
        if (requestedMethod == "CARD" && !System.Text.RegularExpressions.Regex.IsMatch(request.CardLast4 ?? string.Empty, "^\\d{4}$")) return BadRequest("Card last 4 digits are required for card payment.");
        if (requestedMethod is "UPI_QR" or "BANK_TRANSFER" && string.IsNullOrWhiteSpace(request.Utr)) return BadRequest("UTR / transaction ID is required.");
        var invoice = await db.Invoices.AsNoTracking().FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken); if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_PENDING") return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");
        if (!string.Equals(invoice.PaymentMethodRequested, requestedMethod, StringComparison.OrdinalIgnoreCase)) return BadRequest($"Payment method mismatch. Cashier requested '{invoice.PaymentMethodRequested}', but Accounts submitted '{requestedMethod}'.");
        if (Math.Abs(request.Amount - invoice.GrandTotal) > 0.01m) return BadRequest($"Payment amount must exactly match the invoice grand total of {invoice.GrandTotal:0.00}. Partial payment is not supported in this workflow.");
        var reference = request.SpecificReference.Trim();
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var updated = await db.Invoices.Where(x => x.Id == invoiceId && x.WorkflowStatus == "PAYMENT_PENDING").ExecuteUpdateAsync(setters => setters
                .SetProperty(x => x.PaymentConfirmedByUserId, accountsUser.Id).SetProperty(x => x.PaymentConfirmedByName, accountsUser.DisplayName).SetProperty(x => x.PaymentConfirmedAtUtc, DateTime.UtcNow).SetProperty(x => x.PaymentMethodConfirmed, requestedMethod).SetProperty(x => x.PaymentSpecificReference, reference).SetProperty(x => x.PaymentBankName, string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim()).SetProperty(x => x.PaymentCardLast4, string.IsNullOrWhiteSpace(request.CardLast4) ? null : request.CardLast4.Trim()).SetProperty(x => x.PaymentUtr, string.IsNullOrWhiteSpace(request.Utr) ? null : request.Utr.Trim()).SetProperty(x => x.PaymentRemarks, string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim()).SetProperty(x => x.WorkflowStatus, "PAYMENT_CONFIRMED").SetProperty(x => x.Status, "PAID"), cancellationToken);
            if (updated != 1) { await transaction.RollbackAsync(cancellationToken); return Conflict("Payment was not confirmed because the invoice changed state. Refresh and try again."); }
            db.Payments.Add(new Payment { Id = Guid.NewGuid(), InvoiceId = invoiceId, Amount = request.Amount, Method = requestedMethod, PaymentDateUtc = request.PaymentDateUtc == default ? DateTime.UtcNow : request.PaymentDateUtc, Reference = reference });
            db.AuditLogs.Add(new AuditLog { UserId = accountsUser.Id, Action = "INVOICE_PAYMENT_CONFIRMED", EntityName = nameof(Invoice), EntityId = invoiceId, Details = $"Accounts confirmed {requestedMethod} payment: amount {request.Amount:0.00}, reference {reference}.", CreatedAtUtc = DateTime.UtcNow });
            await db.SaveChangesAsync(cancellationToken); await transaction.CommitAsync(cancellationToken);
        }
        catch { await transaction.RollbackAsync(cancellationToken); throw; }
        return Ok(await db.Invoices.AsNoTracking().Include(x => x.Payments).FirstAsync(x => x.Id == invoiceId, cancellationToken));
    }

    [Authorize(Roles = "WAREHOUSE")]
    [HttpPost("{invoiceId:guid}/load")]
    public async Task<ActionResult> MarkLoaded(Guid invoiceId, WarehouseLoadRequest request, CancellationToken cancellationToken)
    {
        var warehouseId = GetAuthenticatedUserId(); if (!warehouseId.HasValue || request.UserId != warehouseId.Value) return Forbid();
        var warehouseUser = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == warehouseId.Value && x.IsActive && x.Role == "WAREHOUSE", cancellationToken); if (warehouseUser is null) return BadRequest("Only an active Warehouse user can load an invoice.");
        if (string.IsNullOrWhiteSpace(request.LoadedBy) || string.IsNullOrWhiteSpace(request.VerifiedBy)) return BadRequest("Loaded By and Verified By are required.");
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken); if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_CONFIRMED" && invoice.WorkflowStatus != "WAREHOUSE_READY") return BadRequest("Invoice must have confirmed payment before warehouse loading.");
        invoice.WarehouseLoadedBy = request.LoadedBy.Trim(); invoice.WarehouseVerifiedBy = request.VerifiedBy.Trim(); invoice.WarehouseLoadedAtUtc = DateTime.UtcNow; invoice.WarehouseVehicleNumber = string.IsNullOrWhiteSpace(request.VehicleNumber) ? null : request.VehicleNumber.Trim(); invoice.WarehouseRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim(); invoice.WorkflowStatus = "COMPLETED"; invoice.DeliveredAtUtc = DateTime.UtcNow; invoice.DeliveredByName = request.VerifiedBy.Trim();
        db.AuditLogs.Add(new AuditLog { UserId = warehouseUser.Id, Action = "INVOICE_COMPLETED_AFTER_WAREHOUSE_LOAD", EntityName = nameof(Invoice), EntityId = invoice.Id, Details = $"Warehouse loading completed by {request.LoadedBy}; verified by {request.VerifiedBy}; vehicle {request.VehicleNumber}. Order marked COMPLETED.", CreatedAtUtc = DateTime.UtcNow }); await db.SaveChangesAsync(cancellationToken); return Ok(invoice);
    }

    private Guid? GetAuthenticatedUserId() { var value = User.FindFirstValue(ClaimTypes.NameIdentifier); return Guid.TryParse(value, out var userId) ? userId : null; }
    public sealed record ManagerApprovalRequest(Guid UserId, decimal DiscountPercent, string Remarks);
    public sealed record ManagerRejectionRequest(Guid UserId, string Remarks);
    public sealed record PaymentConfirmationRequest(Guid UserId, decimal Amount, string Method, string SpecificReference, string? BankName = null, string? CardLast4 = null, string? Utr = null, string? Remarks = null, DateTime PaymentDateUtc = default);
    public sealed record WarehouseLoadRequest(Guid UserId, string LoadedBy, string VerifiedBy, string? VehicleNumber = null, string? Remarks = null);
}