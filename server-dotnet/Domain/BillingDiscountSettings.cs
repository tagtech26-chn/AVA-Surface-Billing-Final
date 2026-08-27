namespace AVASurface.Server.Domain;

public sealed class BillingDiscountSettings
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CompanyId { get; set; }
    public decimal DefaultSalespersonDiscountPercent { get; set; }
    public decimal MaxSalespersonDiscountPercent { get; set; }
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
    public Guid? UpdatedByUserId { get; set; }
}
