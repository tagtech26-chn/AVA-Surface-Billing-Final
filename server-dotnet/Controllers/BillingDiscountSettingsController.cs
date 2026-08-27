using AVASurface.Server.Domain;
using AVASurface.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/settings/billing-discounts")]
public sealed class BillingDiscountSettingsController(BillingDiscountSettingsService settingsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<BillingDiscountSettings>> Get(CancellationToken ct)
    {
        var companyId = await GetUserCompanyIdAsync(ct);
        if (companyId is null) return BadRequest("The authenticated user is not assigned to a company.");
        return Ok(await settingsService.GetOrCreateAsync(companyId.Value, ct));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpPut]
    public async Task<ActionResult<BillingDiscountSettings>> Update(UpdateRequest request, CancellationToken ct)
    {
        var companyId = await GetUserCompanyIdAsync(ct);
        if (companyId is null) return BadRequest("The authenticated user is not assigned to a company.");
        var userId = GetUserId();
        try
        {
            var result = await settingsService.UpdateAsync(companyId.Value, request.DefaultSalespersonDiscountPercent, request.MaxSalespersonDiscountPercent, userId, ct);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    private Guid? GetUserId()
        => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private async Task<Guid?> GetUserCompanyIdAsync(CancellationToken ct)
    {
        // The service deliberately receives the company resolved from the authenticated user,
        // rather than accepting an arbitrary company id from the browser.
        return await settingsService.GetUserCompanyIdAsync(GetUserId(), ct);
    }

    public sealed record UpdateRequest(decimal DefaultSalespersonDiscountPercent, decimal MaxSalespersonDiscountPercent);
}
