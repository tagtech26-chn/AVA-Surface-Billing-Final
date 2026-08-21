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
public sealed class AuditLogDbController(BillingDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<AuditLogDto>>> Get(CancellationToken cancellationToken)
    {
        var rows = await db.AuditLogs
            .AsNoTracking()
            .OrderByDescending(x => x.CreatedAtUtc)
            .Take(2000)
            .ToListAsync(cancellationToken);

        var userIds = rows.Where(x => x.UserId.HasValue).Select(x => x.UserId!.Value).Distinct().ToArray();
        var users = await db.AppUsers.AsNoTracking().Where(x => userIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return Ok(rows.Select(x => ToDto(x, users)));
    }

    [Authorize(Roles = "ADMIN")]
    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync("DELETE FROM dbo.AuditLogs", cancellationToken);
        return NoContent();
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateAuditRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Action) || string.IsNullOrWhiteSpace(request.Category))
            return BadRequest("Action and category are required.");

        var userId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : (Guid?)null;
        var payload = JsonSerializer.Serialize(new
        {
            request.Severity,
            request.TargetId,
            request.TargetName,
            request.Details,
            request.PreviousValue,
            request.NewValue,
            request.IpAddress,
            PerformedBy = request.PerformedBy,
            PerformedByRole = request.PerformedByRole
        });

        db.AuditLogs.Add(new AuditLog
        {
            UserId = userId,
            Action = request.Action.Trim(),
            EntityName = request.Category.Trim(),
            EntityId = Guid.TryParse(request.TargetId, out var entityId) ? entityId : null,
            Details = payload,
            CreatedAtUtc = string.IsNullOrWhiteSpace(request.Timestamp) || !DateTime.TryParse(request.Timestamp, out var timestamp)
                ? DateTime.UtcNow
                : timestamp.ToUniversalTime()
        });

        await db.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    private static AuditLogDto ToDto(AuditLog row, IReadOnlyDictionary<Guid, AppUser> users)
    {
        var severity = "LOW";
        string? targetId = row.EntityId?.ToString();
        string? targetName = null;
        string details = row.Details ?? string.Empty;
        string? previous = null;
        string? next = null;
        string performedBy = users.TryGetValue(row.UserId ?? Guid.Empty, out var user) ? user.DisplayName : "System User";
        string performedByRole = users.TryGetValue(row.UserId ?? Guid.Empty, out user) ? user.Role : "ADMIN";
        string? ipAddress = null;

        try
        {
            using var doc = JsonDocument.Parse(details);
            var root = doc.RootElement;
            severity = root.TryGetProperty("Severity", out var severityElement) ? severityElement.GetString() ?? severity : severity;
            targetId = root.TryGetProperty("TargetId", out var targetIdElement) ? targetIdElement.GetString() ?? targetId : targetId;
            targetName = root.TryGetProperty("TargetName", out var targetNameElement) ? targetNameElement.GetString() : null;
            details = root.TryGetProperty("Details", out var detailsElement) ? detailsElement.GetString() ?? string.Empty : details;
            previous = root.TryGetProperty("PreviousValue", out var previousElement) ? previousElement.GetString() : null;
            next = root.TryGetProperty("NewValue", out var newElement) ? newElement.GetString() : null;
            ipAddress = root.TryGetProperty("IpAddress", out var ipElement) ? ipElement.GetString() : null;
            performedBy = root.TryGetProperty("PerformedBy", out var performedByElement) ? performedByElement.GetString() ?? performedBy : performedBy;
            performedByRole = root.TryGetProperty("PerformedByRole", out var roleElement) ? roleElement.GetString() ?? performedByRole : performedByRole;
        }
        catch (JsonException)
        {
            // Legacy audit rows used plain text Details; keep them readable.
        }

        return new AuditLogDto(
            row.Id.ToString(), row.CreatedAtUtc, row.EntityName, severity, row.Action,
            performedBy, performedByRole, targetId, targetName, details, previous, next, ipAddress);
    }

    public sealed record CreateAuditRequest(
        string Category,
        string Severity,
        string Action,
        string Details,
        string? PerformedBy,
        string? PerformedByRole,
        string? TargetName,
        string? TargetId,
        string? PreviousValue,
        string? NewValue,
        string? IpAddress,
        string? Timestamp);

    public sealed record AuditLogDto(
        string Id,
        DateTime Timestamp,
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
