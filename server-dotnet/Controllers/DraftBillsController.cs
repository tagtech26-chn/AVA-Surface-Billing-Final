using System.Security.Claims;
using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/drafts")]
[Authorize]
public sealed class DraftBillsController(BillingDbContext db) : ControllerBase
{
    private Guid? CurrentUserId =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private async Task EnsureTableAsync(CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'dbo.DraftBills', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.DraftBills
    (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_DraftBills PRIMARY KEY,
        UserId uniqueidentifier NOT NULL,
        CustomerId uniqueidentifier NULL,
        CustomerName nvarchar(200) NOT NULL,
        CustomerPhone nvarchar(50) NOT NULL,
        CustomerType nvarchar(20) NOT NULL,
        PayloadJson nvarchar(max) NOT NULL,
        SavedBy nvarchar(150) NOT NULL,
        TotalAmount decimal(18,2) NOT NULL,
        TotalWeightKg decimal(18,3) NOT NULL,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_DraftBills_CreatedAtUtc DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_DraftBills_UserId_CreatedAtUtc
        ON dbo.DraftBills(UserId, CreatedAtUtc DESC);
END", cancellationToken);
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (!userId.HasValue) return Unauthorized();

        await EnsureTableAsync(cancellationToken);

        var rows = await db.DraftBills.AsNoTracking()
            .Where(x => x.UserId == userId.Value)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return Ok(rows.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDraftRequest request, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (!userId.HasValue) return Unauthorized();
        if (string.IsNullOrWhiteSpace(request.PayloadJson))
            return BadRequest(new { message = "Draft payload is required." });

        await EnsureTableAsync(cancellationToken);

        var user = await db.AppUsers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId.Value && x.IsActive, cancellationToken);
        if (user is null) return Unauthorized();

        var existing = request.Id.HasValue
            ? await db.DraftBills.FirstOrDefaultAsync(x => x.Id == request.Id.Value && x.UserId == user.Id, cancellationToken)
            : null;

        if (existing is not null)
            return Ok(ToDto(existing));

        var entity = new DraftBill
        {
            Id = request.Id.GetValueOrDefault() == Guid.Empty ? Guid.NewGuid() : request.Id!.Value,
            UserId = user.Id,
            CustomerId = request.CustomerId,
            CustomerName = request.CustomerName?.Trim() ?? string.Empty,
            CustomerPhone = request.CustomerPhone?.Trim() ?? string.Empty,
            CustomerType = string.IsNullOrWhiteSpace(request.CustomerType) ? "NORMAL" : request.CustomerType.Trim().ToUpperInvariant(),
            PayloadJson = request.PayloadJson,
            SavedBy = string.IsNullOrWhiteSpace(request.SavedBy) ? user.DisplayName : request.SavedBy.Trim(),
            TotalAmount = request.TotalAmount,
            TotalWeightKg = request.TotalWeightKg,
            CreatedAtUtc = request.CreatedAtUtc == default ? DateTime.UtcNow : request.CreatedAtUtc.ToUniversalTime()
        };

        db.DraftBills.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(entity));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var userId = CurrentUserId;
        if (!userId.HasValue) return Unauthorized();

        await EnsureTableAsync(cancellationToken);

        var entity = await db.DraftBills.FirstOrDefaultAsync(x => x.Id == id && x.UserId == userId.Value, cancellationToken);
        if (entity is null) return NotFound(new { message = "Held bill not found." });

        db.DraftBills.Remove(entity);
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static DraftDto ToDto(DraftBill row) => new(
        row.Id,
        row.CreatedAtUtc,
        row.CustomerId,
        row.CustomerName,
        row.CustomerPhone,
        row.CustomerType,
        row.PayloadJson,
        row.SavedBy,
        row.TotalAmount,
        row.TotalWeightKg);

    public sealed record CreateDraftRequest(
        Guid? Id,
        Guid? CustomerId,
        string? CustomerName,
        string? CustomerPhone,
        string? CustomerType,
        string PayloadJson,
        string? SavedBy,
        decimal TotalAmount,
        decimal TotalWeightKg,
        DateTime CreatedAtUtc);

    public sealed record DraftDto(
        Guid Id,
        DateTime CreatedAtUtc,
        Guid? CustomerId,
        string CustomerName,
        string CustomerPhone,
        string CustomerType,
        string PayloadJson,
        string SavedBy,
        decimal TotalAmount,
        decimal TotalWeightKg);
}
