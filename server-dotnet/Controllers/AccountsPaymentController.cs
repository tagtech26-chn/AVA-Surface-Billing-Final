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

        var method = NormalizeMethod(request.Method);
        if (method is null) return BadRequest("Invalid payment method. Use CASH, CARD, UPI_QR or BANK_TRANSFER.");
        var requestedMethod = NormalizeMethod(invoice.PaymentMethodRequested);
        if (requestedMethod is not null && !string.Equals(requestedMethod, method, StringComparison.OrdinalIgnoreCase))
            return BadRequest($"Payment method mismatch. Invoice requested '{invoice.PaymentMethodRequested}', but Accounts submitted '{request.Method}'.");

        if (string.IsNullOrWhiteSpace(request.Reference)) return BadRequest("Payment receipt/reference is required.");
        if (method == "CARD" && !System.Text.RegularExpressions.Regex.IsMatch(request.CardLast4 ?? string.Empty, "^\\d{4}$")) return BadRequest("Card last 4 digits are required.");
        if (method is "UPI_QR" or "BANK_TRANSFER" && string.IsNullOrWhiteSpace(request.Utr)) return BadRequest("UTR / transaction ID is required.");

        // Manager discount is already reflected in GrandTotal. Credit note is NOT part of invoice value;
        // it only reduces the amount that Accounts actually collects.
        var netReceivable = Math.Max(0m, invoice.GrandTotal - invoice.CreditNoteAmount);
        if (Math.Abs(request.Amount - netReceivable) > 0.01m)
            return BadRequest($"Payment amount must exactly match the Accounts collection amount of {netReceivable:0.00}. Invoice value is {invoice.GrandTotal:0.00}, manager discount is {invoice.BranchManagerDiscountAmount:0.00}, and credit note is {invoice.CreditNoteAmount:0.00}.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
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

            // Explicit Id is required by the Payment entity in the workflow implementation.
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                Amount = request.Amount,
                Method = method,
                PaymentDateUtc = request.PaymentDateUtc == default ? DateTime.UtcNow : request.PaymentDateUtc,
                Reference = request.Reference.Trim()
            });

            db.AuditLogs.Add(new AuditLog
            {
                UserId = accounts.Id,
                Action = "INVOICE_PAYMENT_CONFIRMED",
                EntityName = nameof(Invoice),
                EntityId = invoice.Id,
                Details = $"Accounts collected {request.Amount:0.00}; invoice value {invoice.GrandTotal:0.00}; manager discount {invoice.BranchManagerDiscountAmount:0.00}; credit note {invoice.CreditNoteAmount:0.00}; amount to collect {netReceivable:0.00}; method {method}; reference {request.Reference.Trim()}."
            });

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }

        return Ok(new
        {
            invoice.Id,
            invoice.InvoiceNumber,
            invoice.GrandTotal,
            ManagerDiscountAmount = invoice.BranchManagerDiscountAmount,
            CreditNoteAmount = invoice.CreditNoteAmount,
            AmountCollected = request.Amount,
            invoice.WorkflowStatus,
            invoice.Status,
            invoice.PaymentConfirmedByName,
            invoice.PaymentConfirmedAtUtc,
            PaymentMethod = method,
            PaymentReference = request.Reference.Trim()
        });
    }

    private static string? NormalizeMethod(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return value.Trim().ToUpperInvariant() switch
        {
            "CASH" => "CASH",
            "CARD" => "CARD",
            "UPI" or "UPI_QR" or "UPI/QR" or "UPI QR" => "UPI_QR",
            "BANK" or "BANK_TRANSFER" or "BANK TRANSFER" or "TRANSFER" => "BANK_TRANSFER",
            _ => null
        };
    }

    private Guid? GetUserId() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public sealed record PaymentRequest(Guid UserId, decimal Amount, string Method, string Reference, string? BankName = null, string? CardLast4 = null, string? Utr = null, string? Remarks = null, DateTime PaymentDateUtc = default);
}
