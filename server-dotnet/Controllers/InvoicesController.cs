using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/invoices")]
public sealed class InvoicesController(BillingDbContext db) : ControllerBase
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

        var duplicateInvoice = await db.Invoices.AnyAsync(
            x => x.CompanyId == request.CompanyId &&
                 x.InvoiceNumber == request.InvoiceNumber.Trim(),
            cancellationToken);

        if (duplicateInvoice)
            return Conflict("Invoice number already exists for this company.");

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
                string.IsNullOrWhiteSpace(customer.State) ||
                string.IsNullOrWhiteSpace(customer.StateCode))
                return BadRequest("Customer city, state and state code are required before saving the invoice.");

            if (customer.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase) &&
                !IsValidGstin(customer.Gstin))
                return BadRequest("A valid GSTIN is required for B2B customers.");
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

        AppUser? branchManager = null;
        if (request.BranchManagerDiscountPercent > 0)
        {
            if (!request.BranchManagerUserId.HasValue)
                return BadRequest("Branch Manager approval is required for additional discount.");

            if (string.IsNullOrWhiteSpace(request.BranchManagerRemarks))
                return BadRequest("Branch Manager remarks are required for additional discount.");

            branchManager = await db.AppUsers.FirstOrDefaultAsync(
                x => x.Id == request.BranchManagerUserId.Value &&
                     x.IsActive &&
                     x.Role == "BRANCH_MANAGER" &&
                     (!x.CompanyId.HasValue || x.CompanyId == request.CompanyId),
                cancellationToken);

            if (branchManager is null)
                return BadRequest("Selected Branch Manager is invalid or unauthorized.");
        }

        BillingCalculationResult calculation;
        try
        {
            calculation = BillingCalculator.Calculate(
                lineInputs,
                promotions,
                request.BranchManagerDiscountPercent,
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
            var invoiceId = Guid.NewGuid();
            var invoice = new Invoice
            {
                Id = invoiceId,
                CompanyId = request.CompanyId,
                CustomerId = customer?.Id,
                Customer = customer,
                SalespersonId = salesperson.Id,
                Salesperson = salesperson,
                InvoiceNumber = request.InvoiceNumber.Trim(),
                InvoiceDate = request.InvoiceDate == default ? DateTime.UtcNow : request.InvoiceDate,
                SalespersonName = salesperson.Name,
                SalespersonMobile = salesperson.Mobile,
                SubTotal = calculation.SubTotal,
                DiscountAmount = calculation.LineDiscountAmount,
                PromoDiscountPercent = promotions.Sum(x => x.DiscountPercent),
                PromoDiscountAmount = calculation.PromoDiscountAmount,
                BranchManagerDiscountPercent = request.BranchManagerDiscountPercent,
                BranchManagerDiscountAmount = calculation.BranchManagerDiscountAmount,
                BranchManagerUserId = branchManager?.Id,
                BranchManagerRemarks = string.IsNullOrWhiteSpace(request.BranchManagerRemarks)
                    ? null
                    : request.BranchManagerRemarks.Trim(),
                TaxableAmount = calculation.TaxableAmount,
                CgstAmount = calculation.CgstAmount,
                SgstAmount = calculation.SgstAmount,
                IgstAmount = calculation.IgstAmount,
                RoundOffAmount = calculation.RoundOffAmount,
                GrandTotal = calculation.GrandTotal,
                Status = "UNPAID",
                CreatedAtUtc = DateTime.UtcNow
            };

            foreach (var line in request.Lines)
            {
                var product = products[line.ProductId];
                var gross = line.Quantity * product.SellingPrice;
                var lineDiscount = gross * line.DiscountPercent / 100m;

                invoice.Lines.Add(new InvoiceLine
                {
                    Id = Guid.NewGuid(),
                    InvoiceId = invoiceId,
                    ProductId = product.Id,
                    Product = product,
                    Quantity = line.Quantity,
                    UnitPrice = product.SellingPrice,
                    DiscountPercent = line.DiscountPercent,
                    DiscountAmount = Math.Round(lineDiscount, 2, MidpointRounding.AwayFromZero),
                    TaxableAmount = 0m,
                    CgstAmount = 0m,
                    SgstAmount = 0m,
                    IgstAmount = 0m,
                    LineTotal = Math.Round(gross - lineDiscount, 2, MidpointRounding.AwayFromZero)
                });
            }

            db.Invoices.Add(invoice);

            db.AuditLogs.Add(new AuditLog
            {
                UserId = branchManager?.Id,
                Action = request.BranchManagerDiscountPercent > 0 ? "INVOICE_MANAGER_DISCOUNT_APPROVED" : "INVOICE_CREATED",
                EntityName = nameof(Invoice),
                EntityId = invoiceId,
                Details = request.BranchManagerDiscountPercent > 0
                    ? $"Branch Manager discount {request.BranchManagerDiscountPercent:0.##}% approved. Remarks: {request.BranchManagerRemarks}"
                    : "Invoice created with server-side calculation.",
                CreatedAtUtc = DateTime.UtcNow
            });

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private static string? ValidateRequest(InvoiceRequest request)
    {
        if (request.CompanyId == Guid.Empty)
            return "CompanyId is required.";

        if (string.IsNullOrWhiteSpace(request.InvoiceNumber))
            return "Invoice number is required.";

        if (request.InvoiceNumber.Trim().Length > 50)
            return "Invoice number cannot exceed 50 characters.";

        if (request.InvoiceDate == default)
            return "Invoice date is required.";

        if (request.SalespersonId == Guid.Empty)
            return "Salesperson is required.";

        if (request.BranchManagerDiscountPercent < 0 || request.BranchManagerDiscountPercent > 100)
            return "Branch Manager discount must be between 0% and 100%.";

        return null;
    }

    private static bool IsValidGstin(string? gstin)
        => !string.IsNullOrWhiteSpace(gstin) &&
           Regex.IsMatch(
               gstin.Trim().ToUpperInvariant(),
               "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");

    public sealed record InvoiceRequest(
        Guid CompanyId,
        Guid? CustomerId,
        Guid SalespersonId,
        string InvoiceNumber,
        DateTime InvoiceDate,
        List<InvoiceLineRequest> Lines,
        List<string> PromotionCodes,
        decimal BranchManagerDiscountPercent = 0m,
        Guid? BranchManagerUserId = null,
        string? BranchManagerRemarks = null,
        bool InterState = false,
        decimal RoundTo = 5m);

    public sealed record InvoiceLineRequest(
        Guid ProductId,
        decimal Quantity,
        decimal DiscountPercent = 0m);
}
