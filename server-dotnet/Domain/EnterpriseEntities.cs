namespace AVASurface.Server.Domain;

public sealed class InvoiceCancellation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvoiceId { get; set; }
    public Guid CancelledByUserId { get; set; }
    public string CancelledByName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public bool RestockItems { get; set; }
    public decimal RefundAmount { get; set; }
    public DateTime CancelledAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CustomerCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CustomerCategoryAssignment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid CategoryId { get; set; }
    public DateTime AssignedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class CategoryPriceRule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CompanyId { get; set; }
    public Guid CategoryId { get; set; }
    public Guid? ProductId { get; set; }
    public string? ProductGroup { get; set; }
    public decimal? FixedPrice { get; set; }
    public decimal? DiscountPercent { get; set; }
    public DateTime ValidFrom { get; set; } = DateTime.UtcNow.Date;
    public DateTime ValidTo { get; set; } = DateTime.UtcNow.Date.AddYears(10);
    public int Priority { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class CustomerPriceRule
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CustomerId { get; set; }
    public Guid ProductId { get; set; }
    public decimal? FixedPrice { get; set; }
    public decimal? DiscountPercent { get; set; }
    public DateTime ValidFrom { get; set; } = DateTime.UtcNow.Date;
    public DateTime ValidTo { get; set; } = DateTime.UtcNow.Date.AddYears(10);
    public bool IsActive { get; set; } = true;
}

public sealed class Purchase
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CompanyId { get; set; }
    public string PurchaseNumber { get; set; } = string.Empty;
    public DateTime PurchaseDate { get; set; } = DateTime.UtcNow;
    public string SupplierName { get; set; } = string.Empty;
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string Status { get; set; } = "POSTED";
    public ICollection<PurchaseLine> Lines { get; set; } = new List<PurchaseLine>();
}

public sealed class PurchaseLine
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PurchaseId { get; set; }
    public Guid ProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal LineTotal { get; set; }
}
