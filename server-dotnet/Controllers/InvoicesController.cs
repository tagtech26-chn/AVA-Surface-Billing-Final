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
public sealed class InvoicesController(BillingDbContext db, MonthlyInvoicePartitionService monthlyPartitions, CategoryPricingService categoryPricing) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<InvoicePageDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? search = null, [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null, CancellationToken ct = default)
    {
        page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Invoices.AsNoTracking();
        if (from.HasValue) query = query.Where(x => x.InvoiceDate >= from.Value);
        if (to.HasValue) query = query.Where(x => x.InvoiceDate < to.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(search)) { var term = search.Trim(); query = query.Where(x => (x.InvoiceNumber != null && x.InvoiceNumber.Contains(term)) || x.QuotationNumber.Contains(term)); }
        var totalCount = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.InvoiceDate).ThenByDescending(x => x.CreatedAtUtc).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new InvoiceListDto(x.Id, x.InvoiceNumber, x.QuotationNumber, x.InvoiceDate, x.CustomerId, x.Customer != null ? x.Customer.Name : null, x.SalespersonId, x.SalespersonName, x.GrandTotal, x.Status, x.WorkflowStatus, x.PaymentMethodRequested, x.CreatedAtUtc)).ToListAsync(ct);
        return Ok(new InvoicePageDto(items, page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Invoice>> GetById(Guid id, CancellationToken ct)
    {
        var invoice = await db.Invoices.AsNoTracking().Include(x => x.Customer).Include(x => x.Salesperson).Include(x => x.Lines).ThenInclude(x => x.Product).Include(x => x.Payments).FirstOrDefaultAsync(x => x.Id == id, ct);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [Authorize(Roles = "CASHIER,BILLING_USER")]
    [HttpPost("{invoiceId:guid}/request-manager-discount")]
    public async Task<ActionResult> RequestManagerDiscount(Guid invoiceId, ManagerDiscountRequest request, CancellationToken ct)
    {
        if (request.UserId == Guid.Empty) return BadRequest("Billing user is required.");
        var billingUser = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == request.UserId && x.IsActive && (x.Role == "CASHIER" || x.Role == "BILLING_USER"), ct);
        if (billingUser is null) return BadRequest("Only an active Billing/Cashier user can request additional discount approval.");
        var invoice = await db.Invoices.FirstOrDefaultAsync(x => x.Id == invoiceId, ct); if (invoice is null) return NotFound();
        if (invoice.WorkflowStatus != "PAYMENT_PENDING") return BadRequest($"Invoice is currently in workflow state '{invoice.WorkflowStatus}'.");
        if (string.IsNullOrWhiteSpace(request.Remarks)) return BadRequest("Reason/remarks are required for an additional discount request.");
        invoice.WorkflowStatus = "MANAGER_APPROVAL_PENDING"; invoice.BranchManagerDiscountPercent = 0m; invoice.BranchManagerDiscountAmount = 0m; invoice.BranchManagerUserId = null; invoice.BranchManagerRemarks = request.Remarks.Trim();
        db.AuditLogs.Add(new AuditLog { UserId = billingUser.Id, Action = "INVOICE_MANAGER_DISCOUNT_REQUESTED", EntityName = nameof(Invoice), EntityId = invoice.Id, Details = $"Additional discount requested by {billingUser.DisplayName}. Reason: {request.Remarks.Trim()}", CreatedAtUtc = DateTime.UtcNow });
        await db.SaveChangesAsync(ct); return Ok(invoice);
    }

    [Authorize(Roles = "CASHIER,BILLING_USER")]
    [HttpPost]
    public async Task<ActionResult<Invoice>> Create(InvoiceRequest request, CancellationToken ct)
    {
        var basicError = ValidateRequest(request); if (basicError is not null) return BadRequest(basicError);
        var company = await db.Companies.FirstOrDefaultAsync(x => x.Id == request.CompanyId && x.IsActive, ct); if (company is null) return BadRequest("An active company is required.");
        Customer? customer = null;
        if (request.CustomerId.HasValue)
        {
            customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == request.CustomerId.Value && x.CompanyId == request.CompanyId && x.IsActive, ct);
            if (customer is null) return BadRequest("Selected customer is invalid or inactive.");
            if (string.IsNullOrWhiteSpace(customer.Name)) return BadRequest("Customer name is required.");
            if (string.IsNullOrWhiteSpace(customer.BillingAddress)) return BadRequest("Customer billing address is required before saving the invoice.");
            if (string.IsNullOrWhiteSpace(customer.City) || string.IsNullOrWhiteSpace(customer.State)) return BadRequest("Customer city and state are required before saving the invoice.");
            if (customer.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase)) { if (string.IsNullOrWhiteSpace(customer.StateCode)) return BadRequest("State code is required for B2B customers."); if (!IsValidGstin(customer.Gstin)) return BadRequest("A valid GSTIN is required for B2B customers."); }
        }
        var salesperson = await db.Salespersons.FirstOrDefaultAsync(x => x.Id == request.SalespersonId && x.CompanyId == request.CompanyId && x.IsActive, ct);
        if (salesperson is null) return BadRequest("Selected salesperson is invalid or inactive.");
        if (string.IsNullOrWhiteSpace(salesperson.Name) || !Regex.IsMatch(salesperson.Mobile, "^[6-9][0-9]{9}$")) return BadRequest("A valid salesperson with name and 10-digit mobile number is required.");
        if (request.Lines.Count == 0) return BadRequest("At least one invoice line is required.");
        var productIds = request.Lines.Select(x => x.ProductId).Distinct().ToList();
        var products = await db.Products.Where(x => productIds.Contains(x.Id) && x.CompanyId == request.CompanyId && x.IsActive).ToDictionaryAsync(x => x.Id, ct);
        if (products.Count != productIds.Count) return BadRequest("One or more selected products are invalid or inactive.");
        var invoiceDate = request.InvoiceDate == default ? DateTime.UtcNow : request.InvoiceDate;
        var standardPrices = products.Values.Select(x => (x.Id, x.SellingPrice)).ToList();
        var effectivePrices = await categoryPricing.GetEffectivePricesAsync(request.CustomerId, standardPrices, invoiceDate, ct);
        var lineInputs = new List<BillingLineInput>(request.Lines.Count);
        foreach (var line in request.Lines)
        {
            if (line.Quantity <= 0) return BadRequest("Quantity must be greater than zero."); if (line.DiscountPercent < 0 || line.DiscountPercent > 100) return BadRequest("Line discount must be between 0% and 100%.");
            var product = products[line.ProductId]; lineInputs.Add(new BillingLineInput(line.Quantity, effectivePrices[product.Id], line.DiscountPercent, product.GstRate));
        }
        var promotions = new List<BillingPromotionInput>();
        foreach (var promotionCode in request.PromotionCodes.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var promotion = await db.Promotions.FirstOrDefaultAsync(x => x.CompanyId == request.CompanyId && x.Code == promotionCode && x.IsActive && x.ValidFrom <= invoiceDate.Date && x.ValidTo >= invoiceDate.Date, ct);
            if (promotion is null) return BadRequest($"Promotion '{promotionCode}' is invalid, inactive or outside its validity period."); if (!promotion.IsCombinable && request.PromotionCodes.Count > 1) return BadRequest($"Promotion '{promotion.Code}' cannot be combined with another promotion."); if (promotion.MaxDiscountPercent.HasValue && promotion.DiscountPercent > promotion.MaxDiscountPercent.Value) return BadRequest($"Promotion '{promotion.Code}' exceeds its configured maximum discount.");
            promotions.Add(new BillingPromotionInput(promotion.Code, promotion.DiscountPercent, true));
        }
        if (request.BranchManagerDiscountPercent > 0 || request.BranchManagerUserId.HasValue) return BadRequest("Cashier/Billing cannot enter or approve an additional Branch Manager discount. Use the manager approval workflow.");
        BillingCalculationResult calculation; try { calculation = BillingCalculator.Calculate(lineInputs, promotions, 0m, request.InterState, request.RoundTo); } catch (ArgumentException ex) { return BadRequest(ex.Message); }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            var fiscalStartYear = invoiceDate.Month >= 4 ? invoiceDate.Year : invoiceDate.Year - 1; var fy = $"{fiscalStartYear % 100:00}{(fiscalStartYear + 1) % 100:00}"; var lockResource = $"AVASurface.QuotationSeries.{request.CompanyId}.{fy}";
            await db.Database.ExecuteSqlInterpolatedAsync($"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000", ct);
            var existingNumbers = await db.Invoices.Where(x => x.CompanyId == request.CompanyId && x.QuotationNumber.StartsWith("QTN-")).Select(x => x.QuotationNumber).ToListAsync(ct); var nextQuotationNumber = 1;
            foreach (var existingNumber in existingNumbers) { var parts = existingNumber.Split('-'); if (parts.Length != 3 || !parts[0].Equals("QTN", StringComparison.OrdinalIgnoreCase) || !parts[2].Equals(fy, StringComparison.Ordinal)) continue; if (int.TryParse(parts[1], out var parsed) && parsed >= nextQuotationNumber) nextQuotationNumber = parsed + 1; }
            var generatedQuotationNumber = $"QTN-{nextQuotationNumber:0000}-{fy}"; var invoiceId = Guid.NewGuid();
            var invoice = new Invoice { Id = invoiceId, CompanyId = request.CompanyId, CustomerId = customer?.Id, Customer = customer, SalespersonId = salesperson.Id, Salesperson = salesperson, QuotationNumber = generatedQuotationNumber, InvoiceNumber = null, InvoiceDate = invoiceDate, SalespersonName = salesperson.Name, SalespersonMobile = salesperson.Mobile, SubTotal = calculation.SubTotal, DiscountAmount = calculation.LineDiscountAmount, PromoDiscountPercent = promotions.Sum(x => x.DiscountPercent), PromoDiscountAmount = calculation.PromoDiscountAmount, BranchManagerDiscountPercent = 0m, BranchManagerDiscountAmount = 0m, BranchManagerUserId = null, BranchManagerRemarks = null, TaxableAmount = calculation.TaxableAmount, CgstAmount = calculation.CgstAmount, SgstAmount = calculation.SgstAmount, IgstAmount = calculation.IgstAmount, RoundOffAmount = calculation.RoundOffAmount, GrandTotal = calculation.GrandTotal, Status = "UNPAID", WorkflowStatus = "PAYMENT_PENDING", PaymentMethodRequested = request.PaymentMethodRequested, CreatedAtUtc = DateTime.UtcNow };
            var lineBases = request.Lines.Select(line => { var product = products[line.ProductId]; var unitPrice = effectivePrices[product.Id]; var gross = Math.Round(line.Quantity * unitPrice, 2, MidpointRounding.AwayFromZero); var lineDiscount = Math.Round(gross * line.DiscountPercent / 100m, 2, MidpointRounding.AwayFromZero); return new { Line = line, Product = product, UnitPrice = unitPrice, Gross = gross, LineDiscount = lineDiscount, AfterLineDiscount = Math.Max(0m, gross - lineDiscount) }; }).ToList();
            var afterLineDiscountTotal = lineBases.Sum(x => x.AfterLineDiscount); var promoDiscountTotal = calculation.PromoDiscountAmount; var lineResults = new List<(InvoiceLine Line, decimal Taxable, decimal Cgst, decimal Sgst, decimal Igst, decimal Total)>();
            foreach (var item in lineBases)
            {
                var promoAllocation = afterLineDiscountTotal <= 0m ? 0m : Math.Round(promoDiscountTotal * item.AfterLineDiscount / afterLineDiscountTotal, 2, MidpointRounding.AwayFromZero); var taxable = Math.Max(0m, item.AfterLineDiscount - promoAllocation); var tax = Math.Round(taxable * item.Product.GstRate / 100m, 2, MidpointRounding.AwayFromZero); decimal cgst, sgst, igst;
                if (request.InterState) { cgst = 0m; sgst = 0m; igst = tax; } else { cgst = Math.Round(tax / 2m, 2, MidpointRounding.AwayFromZero); sgst = Math.Round(tax - cgst, 2, MidpointRounding.AwayFromZero); igst = 0m; }
                var lineTotal = Math.Round(taxable + cgst + sgst + igst, 2, MidpointRounding.AwayFromZero); var invoiceLine = new InvoiceLine { Id = Guid.NewGuid(), InvoiceId = invoiceId, ProductId = item.Product.Id, Product = item.Product, Quantity = item.Line.Quantity, UnitPrice = item.UnitPrice, DiscountPercent = item.Line.DiscountPercent, DiscountAmount = item.LineDiscount, TaxableAmount = taxable, CgstAmount = cgst, SgstAmount = sgst, IgstAmount = igst, LineTotal = lineTotal }; lineResults.Add((invoiceLine, taxable, cgst, sgst, igst, lineTotal));
            }
            if (lineResults.Count > 0) { var last = lineResults[^1]; last.Line.TaxableAmount += calculation.TaxableAmount - lineResults.Sum(x => x.Taxable); last.Line.CgstAmount += calculation.CgstAmount - lineResults.Sum(x => x.Cgst); last.Line.SgstAmount += calculation.SgstAmount - lineResults.Sum(x => x.Sgst); last.Line.IgstAmount += calculation.IgstAmount - lineResults.Sum(x => x.Igst); last.Line.LineTotal += (calculation.TaxableAmount + calculation.CgstAmount + calculation.SgstAmount + calculation.IgstAmount) - lineResults.Sum(x => x.Total); }
            foreach (var result in lineResults) invoice.Lines.Add(result.Line); db.Invoices.Add(invoice); db.AuditLogs.Add(new AuditLog { UserId = GetAuthenticatedUserId(), Action = "QUOTATION_CREATED", EntityName = nameof(Invoice), EntityId = invoiceId, Details = $"Quotation {generatedQuotationNumber} created by {User.Identity?.Name ?? "authenticated billing user"}; billing-category pricing applied automatically from the customer's mapped category.", CreatedAtUtc = DateTime.UtcNow });
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); await monthlyPartitions.EnsureMonthAsync(invoiceDate, ct); return CreatedAtAction(nameof(GetById), new { id = invoice.Id }, invoice);
        }
        catch { await transaction.RollbackAsync(ct); throw; }
    }

    private Guid? GetAuthenticatedUserId() { var value = User.FindFirstValue(ClaimTypes.NameIdentifier); return Guid.TryParse(value, out var userId) ? userId : null; }
    private static string? ValidateRequest(InvoiceRequest request) => request.CompanyId == Guid.Empty ? "Company is required." : request.SalespersonId == Guid.Empty ? "Salesperson is required." : request.Lines is null ? "Invoice lines are required." : null;
    private static bool IsValidGstin(string? gstin) => !string.IsNullOrWhiteSpace(gstin) && Regex.IsMatch(gstin.Trim().ToUpperInvariant(), "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    public sealed record ManagerDiscountRequest(Guid UserId, string Remarks);
    public sealed record InvoiceRequest(Guid CompanyId, Guid? CustomerId, Guid SalespersonId, DateTime InvoiceDate, bool InterState, string PaymentMethodRequested, decimal RoundTo, decimal BranchManagerDiscountPercent, Guid? BranchManagerUserId, IReadOnlyList<InvoiceLineRequest> Lines, IReadOnlyList<string> PromotionCodes);
    public sealed record InvoiceLineRequest(Guid ProductId, decimal Quantity, decimal DiscountPercent);
    public sealed record InvoicePageDto(IReadOnlyCollection<InvoiceListDto> Items, int Page, int PageSize, int TotalCount, int TotalPages);
    public sealed record InvoiceListDto(Guid Id, string? InvoiceNumber, string QuotationNumber, DateTime InvoiceDate, Guid? CustomerId, string? CustomerName, Guid? SalespersonId, string? SalespersonName, decimal GrandTotal, string Status, string WorkflowStatus, string? PaymentMethodRequested, DateTime CreatedAtUtc);
}
