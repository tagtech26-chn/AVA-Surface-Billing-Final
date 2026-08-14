using System.Text.RegularExpressions;
using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace AVASurface.Server.Services;

public sealed class MonthlyInvoicePartitionService(BillingDbContext db)
{
    public Task EnsureCurrentMonthAsync(CancellationToken cancellationToken = default)
        => EnsureMonthAsync(DateTime.UtcNow, cancellationToken);

    public async Task EnsureMonthAsync(DateTime invoiceDate, CancellationToken cancellationToken = default)
    {
        var names = GetTableNames(invoiceDate);
        var sql = $"""
IF OBJECT_ID(N'dbo.{names.Invoices}', N'U') IS NULL
BEGIN
    SELECT TOP (0) * INTO dbo.{names.Invoices} FROM dbo.Invoices;
    CREATE UNIQUE INDEX IX_{names.Invoices}_Id ON dbo.{names.Invoices} (Id);
    CREATE UNIQUE INDEX IX_{names.Invoices}_Company_InvoiceNumber ON dbo.{names.Invoices} (CompanyId, InvoiceNumber);
    CREATE INDEX IX_{names.Invoices}_InvoiceDate ON dbo.{names.Invoices} (InvoiceDate);
END;

IF OBJECT_ID(N'dbo.{names.InvoiceLines}', N'U') IS NULL
BEGIN
    SELECT TOP (0) * INTO dbo.{names.InvoiceLines} FROM dbo.InvoiceLines;
    CREATE UNIQUE INDEX IX_{names.InvoiceLines}_Id ON dbo.{names.InvoiceLines} (Id);
    CREATE INDEX IX_{names.InvoiceLines}_InvoiceId ON dbo.{names.InvoiceLines} (InvoiceId);
    CREATE INDEX IX_{names.InvoiceLines}_ProductId ON dbo.{names.InvoiceLines} (ProductId);
END;
""";

        await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }

    public async Task MirrorInvoiceAsync(Guid invoiceId, DateTime invoiceDate, CancellationToken cancellationToken = default)
    {
        await EnsureMonthAsync(invoiceDate, cancellationToken);
        var names = GetTableNames(invoiceDate);

        var sql = $"""
INSERT INTO dbo.{names.Invoices}
SELECT *
FROM dbo.Invoices
WHERE Id = {{0}}
  AND NOT EXISTS (SELECT 1 FROM dbo.{names.Invoices} WHERE Id = {{0}});

INSERT INTO dbo.{names.InvoiceLines}
SELECT *
FROM dbo.InvoiceLines
WHERE InvoiceId = {{0}}
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.{names.InvoiceLines} existingLines
      WHERE existingLines.Id = InvoiceLines.Id
  );
""";

        await db.Database.ExecuteSqlRawAsync(sql, [invoiceId], cancellationToken);
    }

    private static (string Invoices, string InvoiceLines) GetTableNames(DateTime invoiceDate)
    {
        var tableSuffix = $"{invoiceDate:yyyy_MM}";
        var invoiceTable = $"Invoices_{tableSuffix}";
        var lineTable = $"InvoiceLines_{tableSuffix}";

        if (!Regex.IsMatch(invoiceTable, "^Invoices_[0-9]{4}_[0-9]{2}$") ||
            !Regex.IsMatch(lineTable, "^InvoiceLines_[0-9]{4}_[0-9]{2}$"))
            throw new InvalidOperationException("Invalid monthly invoice table name.");

        return (invoiceTable, lineTable);
    }
}
