using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/customers")]
public sealed class CustomersController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<CustomerPageDto>> Get([FromQuery] int page = 1, [FromQuery] int pageSize = 50, [FromQuery] string? search = null, [FromQuery] Guid? companyId = null, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = db.Customers.AsNoTracking().Where(x => x.IsActive);
        if (companyId.HasValue) query = query.Where(x => x.CompanyId == companyId.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(x => x.Name.Contains(term) || x.Code.Contains(term) || (x.Phone != null && x.Phone.Contains(term)) || (x.Gstin != null && x.Gstin.Contains(term)));
        }
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query.OrderBy(x => x.Name).ThenBy(x => x.Code)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new CustomerDto(x.Id, x.CompanyId, x.Code, x.Name, x.Phone, x.Email, x.Gstin, x.Address, x.BillingAddress, x.ShippingAddress, x.City, x.State, x.StateCode, x.CustomerType, x.IsActive))
            .ToListAsync(cancellationToken);
        return Ok(new CustomerPageDto(items, page, pageSize, totalCount, (int)Math.Ceiling(totalCount / (double)pageSize)));
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<CustomerSearchDto>>> Search([FromQuery] string q = "", [FromQuery] int limit = 20, [FromQuery] Guid? companyId = null, CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 50);
        var term = q.Trim();
        if (term.Length < 2) return Ok(Array.Empty<CustomerSearchDto>());
        var query = db.Customers.AsNoTracking().Where(x => x.IsActive);
        if (companyId.HasValue) query = query.Where(x => x.CompanyId == companyId.Value);
        var items = await query.Where(x => x.Name.Contains(term) || x.Code.Contains(term) || (x.Phone != null && x.Phone.Contains(term)) || (x.Gstin != null && x.Gstin.Contains(term)))
            .OrderBy(x => x.Name).ThenBy(x => x.Code).Take(limit)
            .Select(x => new CustomerSearchDto(x.Id, x.CompanyId, x.Code, x.Name, x.Phone, x.Gstin, x.CustomerType))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> GetById(Guid id, CancellationToken cancellationToken) { var customer = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken); return customer is null ? NotFound() : Ok(ToDto(customer)); }

    [Authorize(Roles = "ADMIN,BILLING_USER")]
    [HttpPost]
    public async Task<ActionResult<CustomerDto>> Create(CustomerRequest input, CancellationToken cancellationToken)
    {
        var validation = Validate(input); if (validation is not null) return BadRequest(validation);
        if (!await db.Companies.AnyAsync(x => x.Id == input.CompanyId && x.IsActive, cancellationToken)) return BadRequest("An active company is required.");
        var code = input.Code.Trim(); if (await db.Customers.AnyAsync(x => x.CompanyId == input.CompanyId && x.Code == code, cancellationToken)) return Conflict("A customer with this code already exists for the company.");
        var customer = FromRequest(input, code); db.Customers.Add(customer); await db.SaveChangesAsync(cancellationToken); return CreatedAtAction(nameof(GetById), new { id = customer.Id }, ToDto(customer));
    }

    [Authorize(Roles = "ADMIN,BILLING_USER")]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomerDto>> Update(Guid id, CustomerRequest input, CancellationToken cancellationToken)
    {
        var validation = Validate(input); if (validation is not null) return BadRequest(validation);
        var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken); if (customer is null) return NotFound();
        var code = input.Code.Trim(); if (await db.Customers.AnyAsync(x => x.Id != id && x.CompanyId == input.CompanyId && x.Code == code, cancellationToken)) return Conflict("A customer with this code already exists for the company.");
        customer.CompanyId = input.CompanyId; customer.Code = code; customer.Name = input.Name.Trim(); customer.Phone = input.Phone?.Trim(); customer.Email = input.Email?.Trim(); customer.Gstin = input.Gstin?.Trim().ToUpperInvariant(); customer.Address = input.Address?.Trim(); customer.BillingAddress = input.BillingAddress?.Trim(); customer.ShippingAddress = input.ShippingAddress?.Trim(); customer.City = input.City?.Trim(); customer.State = input.State?.Trim(); customer.StateCode = input.StateCode?.Trim(); customer.CustomerType = input.CustomerType.Trim().ToUpperInvariant(); customer.IsActive = input.IsActive;
        await db.SaveChangesAsync(cancellationToken); return Ok(ToDto(customer));
    }

    [Authorize(Roles = "ADMIN,BILLING_USER")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken) { var customer = await db.Customers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken); if (customer is null) return NotFound(); customer.IsActive = false; await db.SaveChangesAsync(cancellationToken); return NoContent(); }
    private static string? Validate(CustomerRequest input) { if (input.CompanyId == Guid.Empty) return "CompanyId is required."; if (string.IsNullOrWhiteSpace(input.Code)) return "Customer code is required."; if (string.IsNullOrWhiteSpace(input.Name)) return "Customer name is required."; if (string.IsNullOrWhiteSpace(input.BillingAddress)) return "Billing address is required."; if (string.IsNullOrWhiteSpace(input.City)) return "City is required."; if (string.IsNullOrWhiteSpace(input.State)) return "State is required."; var type = input.CustomerType.Trim().ToUpperInvariant(); if (type is not ("B2B" or "B2C")) return "CustomerType must be B2B or B2C."; if (type == "B2B" && (string.IsNullOrWhiteSpace(input.StateCode) || !IsValidGstin(input.Gstin))) return "A valid GSTIN and state code are required for B2B customers."; if (!string.IsNullOrWhiteSpace(input.Gstin) && !IsValidGstin(input.Gstin)) return "GSTIN format is invalid."; return null; }
    private static bool IsValidGstin(string? gstin) => !string.IsNullOrWhiteSpace(gstin) && System.Text.RegularExpressions.Regex.IsMatch(gstin.Trim().ToUpperInvariant(), "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$");
    private static Customer FromRequest(CustomerRequest input, string code) => new() { CompanyId = input.CompanyId, Code = code, Name = input.Name.Trim(), Phone = input.Phone?.Trim(), Email = input.Email?.Trim(), Gstin = input.Gstin?.Trim().ToUpperInvariant(), Address = input.Address?.Trim(), BillingAddress = input.BillingAddress?.Trim(), ShippingAddress = input.ShippingAddress?.Trim(), City = input.City?.Trim(), State = input.State?.Trim(), StateCode = input.StateCode?.Trim(), CustomerType = input.CustomerType.Trim().ToUpperInvariant(), IsActive = input.IsActive };
    private static CustomerDto ToDto(Customer x) => new(x.Id, x.CompanyId, x.Code, x.Name, x.Phone, x.Email, x.Gstin, x.Address, x.BillingAddress, x.ShippingAddress, x.City, x.State, x.StateCode, x.CustomerType, x.IsActive);
    public sealed record CustomerRequest(Guid CompanyId, string Code, string Name, string? Phone, string? Email, string? Gstin, string? Address, string? BillingAddress, string? ShippingAddress, string? City, string? State, string? StateCode, string CustomerType = "B2C", bool IsActive = true);
    public sealed record CustomerDto(Guid Id, Guid CompanyId, string Code, string Name, string? Phone, string? Email, string? Gstin, string? Address, string? BillingAddress, string? ShippingAddress, string? City, string? State, string? StateCode, string CustomerType, bool IsActive);
    public sealed record CustomerSearchDto(Guid Id, Guid CompanyId, string Code, string Name, string? Phone, string? Gstin, string CustomerType);
    public sealed record CustomerPageDto(IReadOnlyCollection<CustomerDto> Items, int Page, int PageSize, int TotalCount, int TotalPages);
}
