using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/enterprise")]
public sealed class EnterpriseManagementController(BillingDbContext db) : ControllerBase
{
    private Guid? CurrentUserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;
    private bool IsAdmin => User.IsInRole("ADMIN");
    private bool IsManager => User.IsInRole("MANAGER") || User.IsInRole("BRANCH_MANAGER");

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("invoices/{id:guid}/cancel")]
    public async Task<IActionResult> CancelInvoice(Guid id, CancellationRequest request, CancellationToken cancellationToken)
    {
        var invoice = await db.Invoices.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (invoice is null) return NotFound("Invoice not found.");
        if (invoice.Status == "CANCELLED" || invoice.WorkflowStatus == "CANCELLED") return Conflict("Invoice is already cancelled.");
        if (string.IsNullOrWhiteSpace(request.Reason)) return BadRequest("Cancellation reason is required.");
        var userId = CurrentUserId;
        if (!userId.HasValue) return Unauthorized();
        if (request.RefundAmount < 0 || request.RefundAmount > invoice.GrandTotal) return BadRequest("Refund amount is invalid.");

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            invoice.Status = "CANCELLED";
            invoice.WorkflowStatus = "CANCELLED";
            invoice.DeliveryStatusSafe();
            db.Set<InvoiceCancellation>().Add(new InvoiceCancellation
            {
                InvoiceId = invoice.Id,
                CancelledByUserId = userId.Value,
                CancelledByName = User.FindFirstValue(ClaimTypes.GivenName) ?? User.Identity?.Name ?? "User",
                Reason = request.Reason.Trim(),
                RestockItems = request.RestockItems,
                RefundAmount = request.RefundAmount
            });

            if (request.RestockItems)
            {
                foreach (var line in invoice.Lines)
                {
                    var product = await db.Products.FirstOrDefaultAsync(x => x.Id == line.ProductId, cancellationToken);
                    if (product is null) continue;
                    product.StockQuantity += line.Quantity;
                    db.StockTransactions.Add(new StockTransaction
                    {
                        ProductId = product.Id,
                        QuantityChange = line.Quantity,
                        TransactionType = "INVOICE_CANCELLATION_RESTOCK",
                        ReferenceId = invoice.Id,
                        Notes = request.Reason.Trim()
                    });
                }
            }

            db.AuditLogs.Add(new AuditLog
            {
                UserId = userId.Value,
                Action = "INVOICE_CANCELLED",
                EntityName = nameof(Invoice),
                EntityId = invoice.Id,
                Details = $"Invoice {invoice.InvoiceNumber ?? invoice.QuotationNumber} cancelled. Reason: {request.Reason.Trim()}; restock={request.RestockItems}; refund={request.RefundAmount:0.00}."
            });
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Ok(new { invoice.Id, invoice.Status, invoice.WorkflowStatus, cancellationId = db.Entry(invoice).Property(x => x.Id).CurrentValue });
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPut("products/{id:guid}")]
    public async Task<IActionResult> UpdateProduct(Guid id, ProductManagementRequest request, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null) return NotFound();
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Sku)) return BadRequest("SKU and name are required.");
        product.Sku = request.Sku.Trim();
        product.Name = request.Name.Trim();
        product.HsnCode = request.HsnCode?.Trim();
        product.Unit = string.IsNullOrWhiteSpace(request.Unit) ? "PCS" : request.Unit.Trim();
        product.CostPrice = request.CostPrice;
        product.SellingPrice = request.SellingPrice;
        product.GstRate = request.GstRate;
        product.ReorderLevel = request.ReorderLevel;
        product.IsActive = request.IsActive;
        product.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { product.Id, product.Sku, product.Name, product.SellingPrice, product.IsActive });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("products/{id:guid}/deactivate")]
    public async Task<IActionResult> DeactivateProduct(Guid id, CancellationToken cancellationToken)
    {
        var product = await db.Products.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (product is null) return NotFound();
        product.IsActive = false;
        product.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "ADMIN")]
    [HttpGet("users")]
    public async Task<IActionResult> Users(CancellationToken cancellationToken)
        => Ok(await db.AppUsers.AsNoTracking().OrderBy(x => x.DisplayName).Select(x => new { x.Id, x.UserName, x.DisplayName, x.Role, x.IsActive, x.CompanyId, x.CreatedAtUtc }).ToListAsync(cancellationToken));

    [Authorize(Roles = "ADMIN")]
    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(UserManagementRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserName) || string.IsNullOrWhiteSpace(request.DisplayName) || string.IsNullOrWhiteSpace(request.Password)) return BadRequest("Username, display name and password are required.");
        var role = request.Role.Trim().ToUpperInvariant();
        var allowed = new[] { "ADMIN", "MANAGER", "BRANCH_MANAGER", "CASHIER", "BILLING_USER", "ACCOUNTANT", "WAREHOUSE" };
        if (!allowed.Contains(role)) return BadRequest("Unsupported role.");
        if (await db.AppUsers.AnyAsync(x => x.UserName == request.UserName.Trim(), cancellationToken)) return Conflict("Username already exists.");
        if (request.CompanyId.HasValue && !await db.Companies.AnyAsync(x => x.Id == request.CompanyId.Value && x.IsActive, cancellationToken)) return BadRequest("Selected company is not active or does not exist.");
        var user = new AppUser { CompanyId = request.CompanyId, UserName = request.UserName.Trim(), DisplayName = request.DisplayName.Trim(), Role = role, PasswordHash = PasswordHasher.Hash(request.Password), IsActive = true };
        db.AppUsers.Add(user);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/enterprise/users/{user.Id}", new { user.Id, user.UserName, user.DisplayName, user.Role, user.IsActive, user.CompanyId });
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPut("users/{id:guid}")]
    public async Task<IActionResult> UpdateUser(Guid id, UserUpdateRequest request, CancellationToken cancellationToken)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (user is null) return NotFound();
        if (string.IsNullOrWhiteSpace(request.DisplayName)) return BadRequest("Display name is required.");
        var role = request.Role.Trim().ToUpperInvariant();
        if (role is not ("ADMIN" or "MANAGER" or "BRANCH_MANAGER" or "CASHIER" or "BILLING_USER" or "ACCOUNTANT" or "WAREHOUSE")) return BadRequest("Unsupported role.");
        if (request.CompanyId.HasValue && !await db.Companies.AnyAsync(x => x.Id == request.CompanyId.Value && x.IsActive, cancellationToken)) return BadRequest("Selected company is not active or does not exist.");
        user.CompanyId = request.CompanyId;
        user.DisplayName = request.DisplayName.Trim();
        user.Role = role;
        user.IsActive = request.IsActive;
        if (!string.IsNullOrWhiteSpace(request.Password)) user.PasswordHash = PasswordHasher.Hash(request.Password);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "ADMIN")]
    [HttpGet("customer-categories")]
    public async Task<IActionResult> GetCustomerCategories(CancellationToken cancellationToken)
        => Ok(await db.Set<CustomerCategory>().AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).ToListAsync(cancellationToken));

    [Authorize(Roles = "ADMIN")]
    [HttpPost("customer-categories")]
    public async Task<IActionResult> CreateCustomerCategory(CustomerCategoryRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name)) return BadRequest("Category code and name are required.");
        var category = new CustomerCategory { CompanyId = request.CompanyId, Code = request.Code.Trim().ToUpperInvariant(), Name = request.Name.Trim(), IsActive = true };
        db.Set<CustomerCategory>().Add(category);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(category);
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPost("customers/{customerId:guid}/category")]
    public async Task<IActionResult> AssignCustomerCategory(Guid customerId, CustomerCategoryAssignmentRequest request, CancellationToken cancellationToken)
    {
        if (!await db.Customers.AnyAsync(x => x.Id == customerId, cancellationToken)) return NotFound("Customer not found.");
        if (!await db.Set<CustomerCategory>().AnyAsync(x => x.Id == request.CategoryId && x.IsActive, cancellationToken)) return NotFound("Category not found.");
        var existing = await db.Set<CustomerCategoryAssignment>().FirstOrDefaultAsync(x => x.CustomerId == customerId, cancellationToken);
        if (existing is null) db.Set<CustomerCategoryAssignment>().Add(new CustomerCategoryAssignment { CustomerId = customerId, CategoryId = request.CategoryId });
        else existing.CategoryId = request.CategoryId;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new { customerId, request.CategoryId });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("category-prices")]
    public async Task<IActionResult> CreateCategoryPrice(CategoryPriceRequest request, CancellationToken cancellationToken)
    {
        if (!request.FixedPrice.HasValue && !request.DiscountPercent.HasValue) return BadRequest("FixedPrice or DiscountPercent is required.");
        var row = new CategoryPriceRule { CompanyId = request.CompanyId, CategoryId = request.CategoryId, ProductId = request.ProductId, ProductGroup = request.ProductGroup, FixedPrice = request.FixedPrice, DiscountPercent = request.DiscountPercent, ValidFrom = request.ValidFrom.Date, ValidTo = request.ValidTo.Date, Priority = request.Priority, IsActive = true };
        db.Set<CategoryPriceRule>().Add(row); await db.SaveChangesAsync(cancellationToken); return Ok(row);
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("customer-prices")]
    public async Task<IActionResult> CreateCustomerPrice(CustomerPriceRequest request, CancellationToken cancellationToken)
    {
        if (!request.FixedPrice.HasValue && !request.DiscountPercent.HasValue) return BadRequest("FixedPrice or DiscountPercent is required.");
        var row = new CustomerPriceRule { CustomerId = request.CustomerId, ProductId = request.ProductId, FixedPrice = request.FixedPrice, DiscountPercent = request.DiscountPercent, ValidFrom = request.ValidFrom.Date, ValidTo = request.ValidTo.Date, IsActive = true };
        db.Set<CustomerPriceRule>().Add(row); await db.SaveChangesAsync(cancellationToken); return Ok(row);
    }

    [Authorize]
    [HttpGet("pricing/effective")]
    public async Task<IActionResult> EffectivePrice([FromQuery] Guid productId, [FromQuery] Guid? customerId, CancellationToken cancellationToken)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(x => x.Id == productId, cancellationToken);
        if (product is null) return NotFound("Product not found.");
        var today = DateTime.UtcNow.Date;
        var basePrice = product.SellingPrice;
        CustomerCategoryAssignment? assignment = null;
        if (customerId.HasValue) assignment = await db.Set<CustomerCategoryAssignment>().AsNoTracking().FirstOrDefaultAsync(x => x.CustomerId == customerId.Value, cancellationToken);
        CustomerPriceRule? customerRule = customerId.HasValue ? await db.Set<CustomerPriceRule>().AsNoTracking().Where(x => x.CustomerId == customerId.Value && x.ProductId == productId && x.IsActive && x.ValidFrom <= today && x.ValidTo >= today).OrderByDescending(x => x.Id).FirstOrDefaultAsync(cancellationToken) : null;
        CategoryPriceRule? categoryRule = assignment is null ? null : await db.Set<CategoryPriceRule>().AsNoTracking().Where(x => x.CategoryId == assignment.CategoryId && (x.ProductId == productId || x.ProductId == null) && x.IsActive && x.ValidFrom <= today && x.ValidTo >= today).OrderByDescending(x => x.ProductId.HasValue).ThenByDescending(x => x.Priority).FirstOrDefaultAsync(cancellationToken);
        var finalPrice = basePrice; string source = "STANDARD";
        if (customerRule is not null) { finalPrice = customerRule.FixedPrice ?? Math.Round(basePrice * (1m - (customerRule.DiscountPercent ?? 0m) / 100m), 2); source = "CUSTOMER"; }
        else if (categoryRule is not null) { finalPrice = categoryRule.FixedPrice ?? Math.Round(basePrice * (1m - (categoryRule.DiscountPercent ?? 0m) / 100m), 2); source = "CUSTOMER_CATEGORY"; }
        return Ok(new { productId, customerId, basePrice, finalPrice, source });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER,ACCOUNTANT")]
    [HttpGet("reports/sales")]
    public async Task<IActionResult> SalesReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] string? salesperson, CancellationToken cancellationToken)
    {
        var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date; var end = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);
        var rows = await db.Invoices.AsNoTracking().Where(x => x.InvoiceDate >= start && x.InvoiceDate < end && (x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "COMPLETED") && x.Status != "CANCELLED").Select(x => new { x.InvoiceNumber, x.QuotationNumber, x.InvoiceDate, x.SalespersonName, x.GrandTotal, x.DiscountAmount, x.PromoDiscountAmount, x.BranchManagerDiscountAmount, x.CreditNoteAmount, x.Status }).ToListAsync(cancellationToken);
        if (!string.IsNullOrWhiteSpace(salesperson)) rows = rows.Where(x => x.SalespersonName.Contains(salesperson.Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
        return Ok(new { from = start, to = end.AddDays(-1), totalSales = rows.Sum(x => x.GrandTotal), totalDiscount = rows.Sum(x => x.DiscountAmount + x.PromoDiscountAmount + x.BranchManagerDiscountAmount), totalInvoices = rows.Count, rows });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER,ACCOUNTANT")]
    [HttpGet("reports/purchase")]
    public async Task<IActionResult> PurchaseReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken cancellationToken)
    {
        var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date; var end = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);
        var rows = await db.Set<Purchase>().AsNoTracking().Where(x => x.PurchaseDate >= start && x.PurchaseDate < end && x.Status != "CANCELLED").OrderByDescending(x => x.PurchaseDate).ToListAsync(cancellationToken);
        return Ok(new { from = start, to = end.AddDays(-1), totalPurchase = rows.Sum(x => x.GrandTotal), totalDocuments = rows.Count, rows });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER,ACCOUNTANT")]
    [HttpGet("reports/salespersons")]
    public async Task<IActionResult> SalespersonReport([FromQuery] DateTime? from, [FromQuery] DateTime? to, CancellationToken cancellationToken)
    {
        var start = (from ?? DateTime.UtcNow.Date.AddDays(-30)).Date; var end = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);
        var rows = await db.Invoices.AsNoTracking().Where(x => x.InvoiceDate >= start && x.InvoiceDate < end && (x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "COMPLETED") && x.Status != "CANCELLED").Select(x => new { x.SalespersonName, x.GrandTotal, x.DiscountAmount, x.PromoDiscountAmount, x.BranchManagerDiscountAmount }).ToListAsync(cancellationToken);
        var summary = rows.GroupBy(x => x.SalespersonName).Select(g => new { salesperson = g.Key, invoices = g.Count(), sales = g.Sum(x => x.GrandTotal), discounts = g.Sum(x => x.DiscountAmount + x.PromoDiscountAmount + x.BranchManagerDiscountAmount), averageBill = g.Any() ? g.Average(x => x.GrandTotal) : 0m }).OrderByDescending(x => x.sales).ToList();
        return Ok(new { from = start, to = end.AddDays(-1), summary });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER,ACCOUNTANT")]
    [HttpGet("reports/management-dashboard")]
    public async Task<IActionResult> ManagementDashboard(CancellationToken cancellationToken)
    {
        var today = DateTime.UtcNow.Date; var tomorrow = today.AddDays(1); var monthStart = new DateTime(today.Year, today.Month, 1);
        var sales = await db.Invoices.AsNoTracking().Where(x => x.Status != "CANCELLED" && (x.WorkflowStatus == "PAYMENT_CONFIRMED" || x.WorkflowStatus == "COMPLETED")).Select(x => new { x.InvoiceDate, x.GrandTotal, x.SalespersonName }).ToListAsync(cancellationToken);
        var cancelled = await db.Invoices.AsNoTracking().CountAsync(x => x.Status == "CANCELLED" && x.InvoiceDate >= monthStart, cancellationToken);
        var quotations = await db.Invoices.AsNoTracking().CountAsync(x => x.InvoiceDate >= monthStart && x.WorkflowStatus != "CANCELLED", cancellationToken);
        var converted = sales.Count(x => x.InvoiceDate >= monthStart);
        return Ok(new
        {
            todaySales = sales.Where(x => x.InvoiceDate >= today && x.InvoiceDate < tomorrow).Sum(x => x.GrandTotal),
            monthSales = sales.Where(x => x.InvoiceDate >= monthStart && x.InvoiceDate < tomorrow).Sum(x => x.GrandTotal),
            monthInvoices = sales.Count(x => x.InvoiceDate >= monthStart),
            monthCancelled = cancelled,
            quotationConversionPercent = quotations == 0 ? 0 : Math.Round(converted * 100m / quotations, 2),
            topSalespersons = sales.Where(x => x.InvoiceDate >= monthStart).GroupBy(x => x.SalespersonName).Select(g => new { salesperson = g.Key, sales = g.Sum(x => x.GrandTotal) }).OrderByDescending(x => x.sales).Take(10).ToList()
        });
    }

    [Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER")]
    [HttpPost("purchases")]
    public async Task<IActionResult> CreatePurchase(PurchaseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.PurchaseNumber) || string.IsNullOrWhiteSpace(request.SupplierName)) return BadRequest("Purchase number and supplier are required.");
        var purchase = new Purchase { CompanyId = request.CompanyId, PurchaseNumber = request.PurchaseNumber.Trim(), PurchaseDate = request.PurchaseDate, SupplierName = request.SupplierName.Trim(), SubTotal = request.SubTotal, TaxAmount = request.TaxAmount, GrandTotal = request.GrandTotal, Status = "POSTED" };
        foreach (var line in request.Lines ?? Array.Empty<PurchaseLineRequest>()) purchase.Lines.Add(new PurchaseLine { ProductId = line.ProductId, Quantity = line.Quantity, UnitCost = line.UnitCost, TaxAmount = line.TaxAmount, LineTotal = line.LineTotal });
        db.Set<Purchase>().Add(purchase); await db.SaveChangesAsync(cancellationToken); return Ok(new { purchase.Id, purchase.PurchaseNumber, purchase.GrandTotal });
    }

    public sealed record CancellationRequest(string Reason, bool RestockItems = false, decimal RefundAmount = 0m);
    public sealed record ProductManagementRequest(string Sku, string Name, string? HsnCode, string? Unit, decimal CostPrice, decimal SellingPrice, decimal GstRate, decimal ReorderLevel, bool IsActive = true);
    public sealed record UserManagementRequest(string UserName, string DisplayName, string Role, string Password, Guid? CompanyId);
    public sealed record UserUpdateRequest(string DisplayName, string Role, bool IsActive, string? Password, Guid? CompanyId);
    public sealed record CustomerCategoryRequest(string Code, string Name, Guid? CompanyId);
    public sealed record CustomerCategoryAssignmentRequest(Guid CategoryId);
    public sealed record CategoryPriceRequest(Guid? CompanyId, Guid CategoryId, Guid? ProductId, string? ProductGroup, decimal? FixedPrice, decimal? DiscountPercent, DateTime ValidFrom, DateTime ValidTo, int Priority = 0);
    public sealed record CustomerPriceRequest(Guid CustomerId, Guid ProductId, decimal? FixedPrice, decimal? DiscountPercent, DateTime ValidFrom, DateTime ValidTo);
    public sealed record PurchaseRequest(Guid? CompanyId, string PurchaseNumber, DateTime PurchaseDate, string SupplierName, decimal SubTotal, decimal TaxAmount, decimal GrandTotal, PurchaseLineRequest[]? Lines);
    public sealed record PurchaseLineRequest(Guid ProductId, decimal Quantity, decimal UnitCost, decimal TaxAmount, decimal LineTotal);
}
