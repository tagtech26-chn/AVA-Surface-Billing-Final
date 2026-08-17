using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/invoices")]
[Authorize]
public sealed class InvoicesController(
    BillingDbContext db,
    MonthlyInvoicePartitionService monthlyPartitions) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Invoice>>> Get(CancellationToken cancellationToken)
        => Ok(await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .OrderByDescending(x => x.InvoiceDate)
            .ToListAsync(cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Invoice>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.AsNoTracking()
            .Include(x => x.Customer)
            .Include(x => x.Salesperson)
            .Include(x => x.Lines).ThenInclude(x => x.Product)
            .Include(x => x.Payments)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return invoice is null ? NotFound() : Ok(invoice);
    }

    [Authorize(Roles = "CASHIER,BILLING_USER")]
    [HttpPost("{invoiceId:guid}/request-manager-discount")]
    public async Task<ActionResult> RequestManagerDiscount(Guid invoiceId, ManagerDiscountRequest request, CancellationToken cancellationToken)
    {
        if (request.UserId == Guid.Empty)
            return BadRequest("Billing user is required.");

        var billingUser = await db.AppUsers.FirstOrDefaultAsync(
            x => x.Id == request.UserId && x.IsActive && (x.Role == "CASHIER" || x.Role == "BILLING_USER"),
            cancellationToken);
        if (billingUser is null)
            return BadRequest("Only an active Billing/Cashier user can request additional discount approval.");

        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, cancellationToken);
        if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_PENDING")
            return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");

        if (string.IsNullOrWhiteSpace(request.Remarks))
            return BadRequest("Reason/remarks are required for an additional discount request.");

        invoice.WorkflowStatus = "MANAGER_APPROVAL_PENDING";
        invoice.BranchManagerDiscountPercent = 0m;
        invoice.BranchManagerDiscountAmount = 0m;
        invoice.BranchManagerUserId = null;
        invoice.BranchManagerRemarks = request.Remarks.Trim();

        db.AuditLogs.Add(new AuditLog
        {
            UserId = billingUser.Id,
            Action = "INVOICE_MANAGER_DISCOUNT_REQUESTED",
            EntityName = nameof(Invoice),
            EntityId = invoice.Id,
            Details = $"Additional discount requested by {billingUser.DisplayName}. Reason: {request.Remarks.Trim()}",
            CreatedAtUtc = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok(invoice);
    }

    [Authorize(Roles = "CASHIER,BILLING_USER")]
    [HttpPost]
    public async Task<ActionResult<Invoice>> Create(InvoiceRequest request, CancellationToken cancellationToken)
    {
        var basicError = ValidateRequest(request);
        if (basicError is not null)
            return BadRequest(basicError);

        var company = await db.Companies.FirstOrDefaultAsync(
            x => x.Id == request.CompanyId && x.IsActive,
            cancellationToken);

        if (company is null)
            return BadRequest("An active company is required.");

        Customer? customer = null;
        if (request.CustomerId.HasValue)
        {
            customer = await db.Customers.FirstOrDefaultAsync(
                x => x.Id == request.CustomerId.Value &&
                     x.CompanyId == request.CompanyId &&
                     x.IsActive,
                cancellationToken);

            if (customer is null)
                return BadRequest("Selected customer is invalid or inactive.");

            if (string.IsNullOrWhiteSpace(customer.Name))
                return BadRequest("Customer name is required.");

            if (string.IsNullOrWhiteSpace(customer.BillingAddress))
                return BadRequest("Customer billing address is required before saving the invoice.");

            if (string.IsNullOrWhiteSpace(customer.City) ||
                string.IsNullOrWhiteSpace(customer.State))
                return BadRequest("Customer city and state are required before saving the invoice.");

            if (customer.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrWhiteSpace(customer.StateCode))
                    return BadRequest("State code is required for B2B customers.");

                if (!IsValidGstin(customer.Gstin))
                    return BadRequest("A valid GSTIN is required for B2B customers.");
            }
        }

        var salesperson = await db.Salespersons.FirstOrDefaultAsync(
            x => x.Id == request.SalespersonId &&
                 x.CompanyId == request.CompanyId &&
                 x.IsActive,
            cancellationToken);

        if (salesperson is null)
            return BadRequest("Selected salesperson is invalid or inactive.");

        if (string.IsNullOrWhiteSpace(salesperson.Name) ||
            !Regex.IsMatch(salesperson.Mobile, "^[6-9][0-9]{9}$"))
            return BadRequest("A valid salesperson with name and 10-digit mobile number is required.");

        if (request.Lines.Count == 0)
            return BadRequest("At least one invoice line is required.");

        var productIds = request.Lines.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products
            .Where(x => productIds.Contains(x.Id) &&
                        x.CompanyId == request.CompanyId &&
                        x.IsActive)
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        if (products.Count != productIds.Count)
            return BadRequest("One or more selected products are invalid or inactive.");

        var lineInputs = new List<BillingLineInput>(request.Lines.Count);
        foreach (var line in request.Lines)
        {
            if (line.Quantity <= 0)
                return BadRequest("Quantity must be greater than zero.");

            if (line.DiscountPercent < 0 || line.DiscountPercent > 100)
                return BadRequest("Line discount must be between 0% and 100%.");

            var product = products[line.ProductId];
            lineInputs.Add(new BillingLineInput(
                line.Quantity,
                product.SellingPrice,
                line.DiscountPercent,
                product.GstRate));
        }

        var promotions = new List<BillingPromotionInput>();
        foreach (var promotionCode in request.PromotionCodes.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var promotion = await db.Promotions.FirstOrDefaultAsync(
                x => x.CompanyId == request.CompanyId &&
                     x.Code == promotionCode &&
                     x.IsActive &&
                     x.ValidFrom <= request.InvoiceDate.Date &&
                     x.ValidTo >= request.InvoiceDate.Date,
                cancellationToken);

            if (promotion is null)
                return BadRequest($"Promotion '{promotionCode}' is invalid, inactive or outside its validity period.");

            if (!promotion.IsCombinable && request.PromotionCodes.Count > 1)
                return BadRequest($"Promotion '{promotion.Code}' cannot be combined with another promotion.");

            if (promotion.MaxDiscountPercent.HasValue &&
                promotion.DiscountPercent > promotion.MaxDiscountPercent.Value)
                return BadRequest($"Promotion '{promotion.Code}' exceeds its configured maximum discount.");

            promotions.Add(new BillingPromotionInput(
                promotion.Code,
                promotion.DiscountPercent,
                true));
        }

        if (request.BranchManagerDiscountPercent > 0 || request.BranchManagerUserId.HasValue)
            return BadRequest("Cashier/Billing cannot enter or approve an additional Branch Manager discount. Use the manager approval workflow.");

        BillingCalculationResult calculation;
        try
        {
            calculation = BillingCalculator.Calculate(
                lineInputs,
                promotions,
                0m,
                request.InterState,
                request.RoundTo);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var invoiceDate = request.InvoiceDate == default ? DateTime.UtcNow : request.InvoiceDate;
            var fiscalStartYear = invoiceDate.Month >= 4 ? invoiceDate.Year : invoiceDate.Year - 1;
            var fy = $"{fiscalStartYear % 100:00}{(fiscalStartYear + 1) % 100:00}";
            var invoiceNumber = await GenerateInvoiceNumberAsync(fy, cancellationToken);

            var invoice = new Invoice
            {
                Id = Guid.NewGuid(),
                CompanyId = company.Id,
                CustomerId = customer?.Id,
                SalespersonId = salesperson.Id,
                InvoiceNumber = invoiceNumber,
                InvoiceDate = invoiceDate,
                SalespersonName = salesperson.Name,
                SalespersonMobile = salesperson.Mobile,
                SubTotal = calculation.SubTotal,
                DiscountAmount = calculation.DiscountAmount,
                PromoDiscountPercent = calculation.PromoDiscountPercent,
                PromoDiscountAmount = calculation.PromoDiscountAmount,
                BranchManagerDiscountPercent = 0m,
                BranchManagerDiscountAmount = 0m,
                TaxableAmount = calculation.TaxableAmount,
                CgstAmount = calculation.CgstAmount,
                SgstAmount = calculation.SgstAmount,
                IgstAmount = calculation.IgstAmount,
                RoundOffAmount = calculation.RoundOffAmount,
                GrandTotal = calculation.GrandTotal,
                Status = "UNPAID",
                WorkflowStatus = "PAYMENT_PENDING",
                PaymentMethodRequested = request.PaymentMethodRequested,
                CreatedAtUtc = DateTime.UtcNow
            };

            foreach (var line in calculation.Lines)
            {
                invoice.Lines.Add(new InvoiceLine
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoice.Id,
                    ProductId = line.ProductId,
                    Quantity = line.Quantity,
                    UnitPrice = line.UnitPrice,
                    DiscountPercent = line.DiscountPercent,
                    DiscountAmount = line.DiscountAmount,
                    TaxableAmount = line.TaxableAmount,
                    CgstAmount = line.CgstAmount,
                    SgstAmount = line.SgstAmount,
                    IgstAmount = line.IgstAmount,
                    LineTotal = line.LineTotal
                });
            }

            db.Invoices.Add(invoice);
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await monthlyPartitions.MirrorInvoiceAsync(invoice.Id, invoice.InvoiceDate, cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<string> GenerateInvoiceNumberAsync(string fy, CancellationToken cancellationToken)
    {
        var count = await db.Invoices.CountAsync(x => x.InvoiceNumber.EndsWith($"-{fy}"), cancellationToken);
        return $"AVA-{count + 1:0000}-{fy}";
    }

    private static string? ValidateRequest(InvoiceRequest request)
    {
        if (request.CompanyId == Guid.Empty)
            return "Company is required.";
        if (request.SalespersonId == Guid.Empty)
            return "Salesperson is required.";
        if (request.Lines is null || request.Lines.Count == 0)
            return "At least one invoice line is required.";
        if (request.RoundTo < 0)
            return "RoundTo cannot be negative.";
        return null;
    }

    private static bool IsValidGstin(string? gstin)
        => !string.IsNullOrWhiteSpace(gstin) &&
           Regex.IsMatch(gstin.Trim().ToUpperInvariant(), "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
}
