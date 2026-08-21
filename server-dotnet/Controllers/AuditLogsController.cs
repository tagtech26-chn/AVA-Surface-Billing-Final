using System.Security.Claims;
using System.Text.Json;
using AVASurface.Server.Domain;
using AVASurface.Server.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Controllers;

[ApiController]
[Authorize]
[Route("api/audit-logs")]
public sealed class AuditLogsController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditLogDto>>> Get(CancellationToken cancellationToken)
    {
        var rows = await db.AuditLogs.AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(5000)
            .ToListAsync(cancellationToken);

        var userIds = rows.Where(x => x.UserId.HasValue).Select(x => x.UserId!.Value).Distinct().ToList();
        var users = await db.AppUsers.AsNoTracking()
            .Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return Ok(rows.Select(x => ToDto(x, users.TryGetValue(x.UserId ?? Guid.Empty, out var user) ? user : null)));
    }

    [HttpPost]
    public async Task<ActionResult<AuditLogDto>> Create([FromBody] CreateAuditLogRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId.Value && x.IsActive, cancellationToken);
        if (user is null) return Unauthorized();

        var entity = new AuditLog
        {
            UserId = user.Id,
            Action = request.Action.Trim(),
            EntityName = request.Category.Trim().ToUpperInvariant(),
            EntityId = Guid.TryParse(request.TargetId, out var targetId) ? targetId : null,
            Details = JsonSerializer.Serialize(new AuditDetailsEnvelope(
                request.Category.Trim().ToUpperInvariant(),
                request.Severity.Trim().ToUpperInvariant(),
                request.Details,
                request.TargetName,
                request.PreviousValue,
                request.NewValue,
                request.IpAddress)),
            CreatedAtUtc = DateTime.UtcNow
        };

        db.AuditLogs.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        return Ok(ToDto(entity, user));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpDelete]
    public async Task<IActionResult> Purge(CancellationToken cancellationToken)
    {
        await db.AuditLogs.ExecuteDeleteAsync(cancellationToken);
        return NoContent();
    }

    private Guid? GetUserId() =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    private static AuditLogDto ToDto(AuditLog row, AppUser? user)
    {
        var envelope = TryParseEnvelope(row.Details);
        var category = envelope?.Category ?? row.EntityName ?? "SYSTEM";
        var severity = envelope?.Severity ?? "LOW";
        var details = envelope?.Details ?? row.Details ?? string.Empty;
        var targetName = envelope?.TargetName;
        var previousValue = envelope?.PreviousValue;
        var newValue = envelope?.NewValue;
        var ipAddress = envelope?.IpAddress;

        return new AuditLogDto(
            row.Id.ToString(),
            row.CreatedAtUtc.ToString("O"),
            category,
            severity,
            row.Action,
            user?.DisplayName ?? "System User",
            user?.Role ?? "SYSTEM",
            row.EntityId?.ToString(),
            targetName,
            details,
            previousValue,
            newValue,
            ipAddress);
    }

    private static AuditDetailsEnvelope? TryParseEnvelope(string? details)
    {
        if (string.IsNullOrWhiteSpace(details)) return null;
        try { return JsonSerializer.Deserialize<AuditDetailsEnvelope>(details); }
        catch { return null; }
    }

    private sealed record AuditDetailsEnvelope(
        string Category,
        string Severity,
        string Details,
        string? TargetName,
        string? PreviousValue,
        string? NewValue,
        string? IpAddress);

    public sealed record CreateAuditLogRequest(
        string Category,
        string Severity,
        string Action,
        string Details,
        string? TargetName,
        string? TargetId,
        string? PreviousValue,
        string? NewValue,
        string? IpAddress);

    public sealed record AuditLogDto(
        string Id,
        string Timestamp,
        string Category,
        string Severity,
        string Action,
        string PerformedBy,
        string PerformedByRole,
        string? TargetId,
        string? TargetName,
        string Details,
        string? PreviousValue,
        string? NewValue,
        string? IpAddress);
}
