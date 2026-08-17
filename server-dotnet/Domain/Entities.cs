namespace AVASurface.Server.Domain;

public sealed class Company
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string LegalName { get; set; } = string.Empty;
    public string? Gstin { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public string Sku { get; set; } = string.Empty;
    public string Barcode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Category { get; set; }
    public string? HsnCode { get; set; }
    public decimal SalePrice { get; set; }
    public decimal? PurchasePrice { get; set; }
    public decimal GstPercent { get; set; }
    public string? Unit { get; set; }
    public decimal? PiecesPerBox { get; set; }
    public decimal? SqftPerBox { get; set; }
    public decimal? LengthMm { get; set; }
    public decimal? WidthMm { get; set; }
    public string? Finish { get; set; }
    public string? Type { get; set; }
    public string? Batch { get; set; }
    public decimal? PricePerSqft { get; set; }
    public decimal? WeightPerBoxKg { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Promotion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal DiscountPercent { get; set; }
    public DateTime ValidFrom { get; set; }
    public DateTime ValidTo { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsCombinable { get; set; } = true;
    public int Priority { get; set; }
    public decimal? MaxDiscountPercent { get; set; }
    public string? ProductCategory { get; set; }
    public string? CustomerType { get; set; }
    public string? Remarks { get; set; }
}

public sealed class AppUser
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CompanyId { get; set; }
    public Company? Company { get; set; }
    public string UserName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = "BILLING_USER";
    public bool IsActive { get; set; } = true;
    public string? PasswordHash { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class Invoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid? SalespersonId { get; set; }
    public Salesperson? Salesperson { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; } = DateTime.UtcNow;
    public string Status { get; set; } = "UNPAID";
    public decimal SubTotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal TaxTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public string WorkflowStatus { get; set; } = "PAYMENT_PENDING";
}

public sealed class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Gstin { get; set; }
    public string? BillingAddress { get; set; }
    public string? ShippingAddress { get; set; }
    public string? Pincode { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class Salesperson
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public Company Company { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
