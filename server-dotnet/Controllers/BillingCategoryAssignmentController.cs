using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize(Roles = "ADMIN,MANAGER,BRANCH_MANAGER,BILLING_USER")]
[Route("api/billing-categories/customer-assignment")]
public sealed class BillingCategoryAssignmentController(BillingDbContext db) : ControllerBase
{
    [HttpPut("{customerId:guid}")]
    public async Task<IActionResult> Assign(Guid customerId, AssignRequest request, CancellationToken ct)
    {
        if (!await db.Customers.AsNoTracking().AnyAsync(x => x.Id == customerId && x.IsActive, ct))
            return NotFound("Active customer not found.");
        if (!await db.CustomerCategories.AsNoTracking().AnyAsync(x => x.Id == request.CategoryId && x.IsActive, ct))
            return NotFound("Billing category not found.");

        var assignment = await db.CustomerCategoryAssignments.FirstOrDefaultAsync(x => x.CustomerId == customerId, ct);
        if (assignment is null)
            db.CustomerCategoryAssignments.Add(new AVASurface.Server.Domain.CustomerCategoryAssignment { CustomerId = customerId, CategoryId = request.CategoryId });
        else
            assignment.CategoryId = request.CategoryId;

        await db.SaveChangesAsync(ct);
        return Ok(new { customerId, categoryId = request.CategoryId });
    }

    public sealed record AssignRequest(Guid CategoryId);
}
