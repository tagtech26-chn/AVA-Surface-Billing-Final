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
        var sql = $@"
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
";

        await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
    }

    public async Task MirrorInvoiceAsync(Guid invoiceId, DateTime invoiceDate, CancellationToken cancellationToken = default)
    {
        await EnsureMonthAsync(invoiceDate, cancellationToken);
        var names = GetTableNames(invoiceDate);

        // Monthly archive tables may have been created by an older application
        // version. Never use SELECT * for the mirror: the source and archive can
        // legitimately have different column counts after a schema evolution.
        // Build the INSERT column list from columns present in both tables.
        const string invoiceIdParameter = "{0}";
        var sql = $@"
DECLARE @InvoiceColumns nvarchar(max);
DECLARE @LineColumns nvarchar(max);

SELECT @InvoiceColumns = STRING_AGG(QUOTENAME(src.name), ',') WITHIN GROUP (ORDER BY src.column_id)
FROM sys.columns src
INNER JOIN sys.columns dst
    ON dst.object_id = OBJECT_ID(N'dbo.{names.Invoices}', N'U')
   AND dst.name = src.name
WHERE src.object_id = OBJECT_ID(N'dbo.Invoices', N'U')
  AND src.is_computed = 0
  AND dst.is_computed = 0;

SELECT @LineColumns = STRING_AGG(QUOTENAME(src.name), ',') WITHIN GROUP (ORDER BY src.column_id)
FROM sys.columns src
INNER JOIN sys.columns dst
    ON dst.object_id = OBJECT_ID(N'dbo.{names.InvoiceLines}', N'U')
   AND dst.name = src.name
WHERE src.object_id = OBJECT_ID(N'dbo.InvoiceLines', N'U')
  AND src.is_computed = 0
  AND dst.is_computed = 0;

IF @InvoiceColumns IS NULL OR @LineColumns IS NULL
    THROW 50001, 'Monthly invoice archive tables have no compatible columns.', 1;

DECLARE @Sql nvarchar(max) = N'
INSERT INTO dbo.{names.Invoices} (' + @InvoiceColumns + N')
SELECT ' + @InvoiceColumns + N'
FROM dbo.Invoices
WHERE Id = @InvoiceId
  AND NOT EXISTS (
      SELECT 1 FROM dbo.{names.Invoices} WHERE Id = @InvoiceId
  );

INSERT INTO dbo.{names.InvoiceLines} (' + @LineColumns + N')
SELECT ' + @LineColumns + N'
FROM dbo.InvoiceLines
WHERE InvoiceId = @InvoiceId
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.{names.InvoiceLines} existingLines
      WHERE existingLines.Id = InvoiceLines.Id
  );';

EXEC sys.sp_executesql @Sql, N'@InvoiceId uniqueidentifier', @InvoiceId = {invoiceIdParameter};
";

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
