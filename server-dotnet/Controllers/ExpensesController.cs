using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AVASurface.Server.Infrastructure;

namespace AVASurface.Server.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize]
public sealed class ExpensesController(BillingDbContext db) : ControllerBase
{
    private async Task EnsureTableAsync(CancellationToken cancellationToken)
    {
        await db.Database.ExecuteSqlRawAsync(@"
IF OBJECT_ID(N'dbo.Expenses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Expenses
    (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_Expenses PRIMARY KEY,
        Title nvarchar(200) NOT NULL,
        Category nvarchar(50) NOT NULL,
        Amount decimal(18,2) NOT NULL,
        ExpenseDate date NOT NULL,
        PaidTo nvarchar(200) NOT NULL,
        PaymentMethod nvarchar(30) NOT NULL,
        RecordedBy nvarchar(150) NOT NULL,
        ReceiptNumber nvarchar(100) NULL,
        Notes nvarchar(1000) NULL,
        CreatedAtUtc datetime2 NOT NULL CONSTRAINT DF_Expenses_CreatedAtUtc DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Expenses_ExpenseDate ON dbo.Expenses(ExpenseDate);
END", cancellationToken);
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        await EnsureTableAsync(cancellationToken);
        var rows = await db.Database.SqlQuery<ExpenseRow>($@"
SELECT Id, Title, Category, Amount, ExpenseDate, PaidTo, PaymentMethod, RecordedBy, ReceiptNumber, Notes
FROM dbo.Expenses
ORDER BY ExpenseDate DESC, CreatedAtUtc DESC").ToListAsync(cancellationToken);
        return Ok(rows);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Amount <= 0)
            return BadRequest(new { message = "Expense title and a positive amount are required." });

        await EnsureTableAsync(cancellationToken);
        var user = User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.GivenName) ?? "Unknown";
        var id = Guid.NewGuid();
        var recordedBy = string.IsNullOrWhiteSpace(request.RecordedBy) ? user : request.RecordedBy.Trim();

        await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO dbo.Expenses
(Id, Title, Category, Amount, ExpenseDate, PaidTo, PaymentMethod, RecordedBy, ReceiptNumber, Notes)
VALUES
({id}, {request.Title.Trim()}, {request.Category.Trim()}, {request.Amount}, {request.Date.Date}, {request.PaidTo?.Trim() ?? "Vendor"}, {request.PaymentMethod.Trim()}, {recordedBy}, {request.ReceiptNumber?.Trim()}, {request.Notes?.Trim()})", cancellationToken);

        return Ok(new ExpenseRow(id, request.Title.Trim(), request.Category.Trim(), request.Amount, request.Date.Date,
            request.PaidTo?.Trim() ?? "Vendor", request.PaymentMethod.Trim(), recordedBy, request.ReceiptNumber?.Trim(), request.Notes?.Trim()));
    }

    public sealed record CreateExpenseRequest(string Title, string Category, decimal Amount, DateTime Date, string? PaidTo, string PaymentMethod, string? RecordedBy, string? ReceiptNumber, string? Notes);
    public sealed record ExpenseRow(Guid Id, string Title, string Category, decimal Amount, DateTime ExpenseDate, string PaidTo, string PaymentMethod, string RecordedBy, string? ReceiptNumber, string? Notes);
}
