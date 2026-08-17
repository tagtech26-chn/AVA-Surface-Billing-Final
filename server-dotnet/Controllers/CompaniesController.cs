using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/companies")]
public sealed class CompaniesController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Company>>> Get(CancellationToken cancellationToken)
        => Ok(await db.Companies.AsNoTracking().OrderBy(x => x.LegalName).ToListAsync(cancellationToken));

    [Authorize(Roles = "ADMIN")]
    [HttpPost]
    public async Task<ActionResult<Company>> Create(Company company, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(company.Code) || string.IsNullOrWhiteSpace(company.LegalName)) return BadRequest("Code and LegalName are required.");
        company.Id = Guid.NewGuid();
        db.Companies.Add(company);
        await db.SaveChangesAsync(cancellationToken);
        return Created($"/api/companies/{company.Id}", company);
    }
}
