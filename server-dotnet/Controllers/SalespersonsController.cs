using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/salespersons")]
public sealed class SalespersonsController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SalespersonDto>>> Get([FromQuery] Guid? companyId, CancellationToken cancellationToken)
    {
        var query = db.Salespersons.AsNoTracking().Where(x => x.IsActive);
        if (companyId.HasValue) query = query.Where(x => x.CompanyId == companyId.Value);
        var rows = await query.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        return Ok(rows.Select(ToDto));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SalespersonDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var row = await db.Salespersons.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return row is null ? NotFound() : Ok(ToDto(row));
    }

    [HttpPost]
    public async Task<ActionResult<SalespersonDto>> Create(SalespersonRequest input, CancellationToken cancellationToken)
    {
        var error = Validate(input);
        if (error is not null) return BadRequest(error);
        if (!await db.Companies.AnyAsync(x => x.Id == input.CompanyId && x.IsActive, cancellationToken))
            return BadRequest("An active company is required.");

        var code = input.Code.Trim().ToUpperInvariant();
        if (await db.Salespersons.AnyAsync(x => x.CompanyId == input.CompanyId && x.Code == code, cancellationToken))
            return Conflict("A salesperson with this code already exists for the company.");

        var row = new Salesperson { CompanyId = input.CompanyId, Code = code, Name = input.Name.Trim(), Mobile = input.Mobile.Trim(), IsActive = input.IsActive };
        db.Salespersons.Add(row);
        await db.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = row.Id }, ToDto(row));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<SalespersonDto>> Update(Guid id, SalespersonRequest input, CancellationToken cancellationToken)
    {
        var error = Validate(input);
        if (error is not null) return BadRequest(error);
        var row = await db.Salespersons.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();

        var code = input.Code.Trim().ToUpperInvariant();
        if (await db.Salespersons.AnyAsync(x => x.Id != id && x.CompanyId == input.CompanyId && x.Code == code, cancellationToken))
            return Conflict("A salesperson with this code already exists for the company.");

        row.CompanyId = input.CompanyId;
        row.Code = code;
        row.Name = input.Name.Trim();
        row.Mobile = input.Mobile.Trim();
        row.IsActive = input.IsActive;
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(row));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
    {
        var row = await db.Salespersons.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (row is null) return NotFound();
        row.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static string? Validate(SalespersonRequest input)
    {
        if (input.CompanyId == Guid.Empty) return "CompanyId is required.";
        if (string.IsNullOrWhiteSpace(input.Code)) return "Salesperson code is required.";
        if (string.IsNullOrWhiteSpace(input.Name)) return "Salesperson name is required.";
        if (!Regex.IsMatch(input.Mobile?.Trim() ?? string.Empty, "^[6-9][0-9]{9}$")) return "A valid 10-digit Indian mobile number is required.";
        return null;
    }

    private static SalespersonDto ToDto(Salesperson x) => new(x.Id, x.CompanyId, x.Code, x.Name, x.Mobile, x.IsActive);

    public sealed record SalespersonRequest(Guid CompanyId, string Code, string Name, string Mobile, bool IsActive = true);
    public sealed record SalespersonDto(Guid Id, Guid CompanyId, string Code, string Name, string Mobile, bool IsActive);
}
