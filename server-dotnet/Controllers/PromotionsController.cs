using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/promotions")]
public sealed class PromotionsController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PromotionDto>>> Get(CancellationToken cancellationToken)
    {
        var rows = await db.Promotions.AsNoTracking()
            .Where(x => x.IsActive)
            .OrderBy(x => x.Priority).ThenBy(x => x.Code)
            .ToListAsync(cancellationToken);
        return Ok(rows.Select(ToDto));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPost]
    public async Task<ActionResult<PromotionDto>> Create(PromotionRequest input, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(input.Code) || string.IsNullOrWhiteSpace(input.Name))
            return BadRequest("Promo code and name are required.");

        var companyId = await ResolveCompanyId(input.CompanyId, cancellationToken);
        if (companyId is null) return BadRequest("No active company is configured.");
        var code = input.Code.Trim().ToUpperInvariant();
        if (await db.Promotions.AnyAsync(x => x.CompanyId == companyId && x.Code == code, cancellationToken))
            return Conflict("A promotion with this code already exists for the company.");

        var promotion = FromRequest(input, companyId.Value, code);
        db.Promotions.Add(promotion);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(Get), new { id = promotion.Id }, ToDto(promotion));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, PromotionRequest input, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (promotion is null) return NotFound();
        var code = input.Code.Trim().ToUpperInvariant();
        if (await db.Promotions.AnyAsync(x => x.CompanyId == promotion.CompanyId && x.Code == code && x.Id != id, cancellationToken))
            return Conflict("A promotion with this code already exists for the company.");

        promotion.Code = code;
        promotion.Name = input.Name.Trim();
        promotion.DiscountPercent = input.DiscountPercent;
        promotion.MaxDiscountPercent = input.MaxDiscountPercent;
        promotion.ProductCategory = input.ProductCategory;
        promotion.CustomerType = input.CustomerType;
        promotion.IsCombinable = input.IsCombinable;
        promotion.IsActive = input.IsActive;
        promotion.ValidFrom = input.ValidFrom.Date;
        promotion.ValidTo = input.ValidTo.Date;
        promotion.Priority = input.Priority;
        promotion.Remarks = input.Remarks;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [Authorize(Roles = "ADMIN")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var promotion = await db.Promotions.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (promotion is null) return NotFound();
        promotion.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<Guid?> ResolveCompanyId(Guid? requested, CancellationToken cancellationToken)
    {
        if (requested.HasValue && requested.Value != Guid.Empty)
            return await db.Companies.AnyAsync(x => x.Id == requested.Value && x.IsActive, cancellationToken) ? requested : null;
        return await db.Companies.Where(x => x.IsActive).OrderBy(x => x.CreatedAtUtc).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(cancellationToken);
    }

    private static Promotion FromRequest(PromotionRequest input, Guid companyId, string code) => new()
    {
        CompanyId = companyId,
        Code = code,
        Name = input.Name.Trim(),
        DiscountPercent = input.DiscountPercent,
        MaxDiscountPercent = input.MaxDiscountPercent,
        ProductCategory = input.ProductCategory,
        CustomerType = input.CustomerType,
        IsCombinable = input.IsCombinable,
        IsActive = input.IsActive,
        ValidFrom = input.ValidFrom.Date,
        ValidTo = input.ValidTo.Date,
        Priority = input.Priority,
        Remarks = input.Remarks
    };

    private static PromotionDto ToDto(Promotion x) => new(
        x.Id, x.Code, x.Name, x.DiscountPercent, x.MaxDiscountPercent, x.ProductCategory,
        x.CustomerType, x.IsCombinable, x.IsActive, x.ValidFrom, x.ValidTo, x.Priority, x.Remarks);

    public sealed record PromotionRequest(Guid? CompanyId, string Code, string Name, decimal DiscountPercent, decimal? MaxDiscountPercent,
        string? ProductCategory, string? CustomerType, bool IsCombinable, bool IsActive, DateTime ValidFrom, DateTime ValidTo,
        int Priority, string? Remarks);
    public sealed record PromotionDto(Guid Id, string Code, string Name, decimal DiscountPercent, decimal? MaxDiscountPercent,
        string? ProductCategory, string? CustomerType, bool IsCombinable, bool IsActive, DateTime ValidFrom, DateTime ValidTo,
        int Priority, string? Remarks);
}
