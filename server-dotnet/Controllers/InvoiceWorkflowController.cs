using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
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

        if ((requestedMethod is "UPI_QR" or "BANK_TRANSFER") &&
            string.IsNullOrWhiteSpace(request.Utr))
            return BadRequest("UTR / transaction ID is required for this payment method.");

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
            Id = Guid.NewGuid(),
            InvoiceId = invoice.Id,
            Amount = request.Amount,
            Method = requestedMethod,
            PaymentDateUtc = request.PaymentDateUtc == default ? DateTime.UtcNow : request.PaymentDateUtc,
            Reference = request.SpecificReference.Trim()
        });

        db.AuditLogs.Add(new AuditLog
        {
            UserId = accountsUser.Id,
            Action = "INVOICE_PAYMENT_CONFIRMED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Accounts confirmed {requestedMethod} payment: amount {request.Amount:0.00}, reference {request.SpecificReference}.",
            CreatedAtUtc = DateTime.UtcNow
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
            UserId = warehouseUser.Id,
            Action = "INVOICE_LOADED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Loaded by {request.LoadedBy}; verified by {request.VerifiedBy}; vehicle {request.VehicleNumber}.",
            CreatedAtUtc = DateTime.UtcNow
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
            UserId = warehouseUser.Id,
            Action = "INVOICE_DELIVERED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Delivered by {invoice.DeliveredByName}. Remarks: {request.Remarks}",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    public sealed record PaymentConfirmationRequest(Guid UserId, decimal Amount, string Method, string SpecificReference, string? BankName = null, string? CardLast4 = null, string? Utr = null, string? Remarks = null, DateTime PaymentDateUtc = default);
    public sealed record WarehouseLoadRequest(Guid UserId, string LoadedBy, string VerifiedBy, string? VehicleNumber = null, string? Remarks = null);
    public sealed record DeliveryConfirmationRequest(Guid UserId, string? DeliveredByName = null, string? Remarks = null);
}
