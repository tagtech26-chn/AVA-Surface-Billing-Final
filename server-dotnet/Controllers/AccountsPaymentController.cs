using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize(Roles = "ACCOUNTANT,ACCOUNTS,ADMIN")]
[Route("api/accounts/invoices")]
public sealed class AccountsPaymentController(BillingDbContext db) : ControllerBase
{
    [HttpPost("{invoiceId:guid}/confirm-payment")]
    public async Task<ActionResult> ConfirmPayment(Guid invoiceId, PaymentRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (!userId.HasValue || request.UserId != userId.Value) return Forbid();
        var accounts = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId.Value && x.IsActive && (x.Role == "ACCOUNTANT" || x.Role == "ACCOUNTS" || x.Role == "ADMIN"), cancellationToken);
        if (accounts is null) return Forbid();

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_PENDING") return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");
        if (request.Amount <= 0) return BadRequest("Payment amount must be greater than zero.");
        var method = request.Method.Trim().ToUpperInvariant();
        if (!new[] { "CASH", "CARD", "UPI_QR", "BANK_TRANSFER" }.Contains(method)) return BadRequest("Invalid payment method.");
        if (!string.Equals(invoice.PaymentMethodRequested, method, StringComparison.OrdinalIgnoreCase)) return BadRequest($"Payment method mismatch. Invoice requested '{invoice.PaymentMethodRequested}'.");
        if (string.IsNullOrWhiteSpace(request.Reference)) return BadRequest("Payment receipt/reference is required.");
        if (method == "CARD" && !System.Text.RegularExpressions.Regex.IsMatch(request.CardLast4 ?? string.Empty, "^\\d{4}$")) return BadRequest("Card last 4 digits are required.");
        if (method is "UPI_QR" or "BANK_TRANSFER" && string.IsNullOrWhiteSpace(request.Utr)) return BadRequest("UTR / transaction ID is required.");

        var netReceivable = Math.Max(0m, invoice.GrandTotal - invoice.CreditNoteAmount);
        if (Math.Abs(request.Amount - netReceivable) > 0.01m) return BadRequest($"Payment amount must exactly match the Accounts collection amount of {netReceivable:0.00}. Invoice value is {invoice.GrandTotal:0.00} and credit note is {invoice.CreditNoteAmount:0.00}.");

        invoice.PaymentConfirmedByUserId = accounts.Id;
        invoice.PaymentConfirmedByName = accounts.DisplayName;
        invoice.PaymentConfirmedAtUtc = DateTime.UtcNow;
        invoice.PaymentMethodConfirmed = method;
        invoice.PaymentSpecificReference = request.Reference.Trim();
        invoice.PaymentBankName = string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim();
        invoice.PaymentCardLast4 = string.IsNullOrWhiteSpace(request.CardLast4) ? null : request.CardLast4.Trim();
        invoice.PaymentUtr = string.IsNullOrWhiteSpace(request.Utr) ? null : request.Utr.Trim();
        invoice.PaymentRemarks = string.IsNullOrWhiteSpace(request.Remarks) ? null : request.Remarks.Trim();
        invoice.WorkflowStatus = "PAYMENT_CONFIRMED";
        invoice.Status = "PAID";
        db.Payments.Add(new Payment { InvoiceId = invoice.Id, Amount = request.Amount, Method = method, PaymentDateUtc = request.PaymentDateUtc == default ? DateTime.UtcNow : request.PaymentDateUtc, Reference = request.Reference.Trim() });
        db.AuditLogs.Add(new AuditLog { UserId = accounts.Id, Action = "INVOICE_PAYMENT_CONFIRMED", EntityName = nameof(Invoice), EntityId = invoice.Id, Details = $"Accounts collected {request.Amount:0.00}; invoice value {invoice.GrandTotal:0.00}; credit note {invoice.CreditNoteAmount:0.00}; method {method}; reference {request.Reference.Trim()}." });
        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    private Guid? GetUserId() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    public sealed record PaymentRequest(Guid UserId, decimal Amount, string Method, string Reference, string? BankName = null, string? CardLast4 = null, string? Utr = null, string? Remarks = null, DateTime PaymentDateUtc = default);
}