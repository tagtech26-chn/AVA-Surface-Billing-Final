using AVASurface.Server.Infrastructure;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations;

[DbContext(typeof(BillingDbContext))]
[Migration("20260822100000_V1_1_EnterpriseSchemaRepair")]
public partial class V1_1_EnterpriseSchemaRepair : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.InvoiceCancellations', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[InvoiceCancellations](
        [Id] uniqueidentifier NOT NULL,
        [InvoiceId] uniqueidentifier NOT NULL,
        [CancelledByUserId] uniqueidentifier NOT NULL,
        [CancelledByName] nvarchar(150) NOT NULL,
        [Reason] nvarchar(500) NOT NULL,
        [RestockItems] bit NOT NULL,
        [RefundAmount] decimal(18,2) NOT NULL,
        [CancelledAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_InvoiceCancellations] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_InvoiceCancellations_InvoiceId' AND object_id = OBJECT_ID(N'dbo.InvoiceCancellations'))
    CREATE INDEX [IX_InvoiceCancellations_InvoiceId] ON [dbo].[InvoiceCancellations]([InvoiceId]);");

        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.CustomerCategories', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CustomerCategories](
        [Id] uniqueidentifier NOT NULL,
        [CompanyId] uniqueidentifier NULL,
        [Code] nvarchar(50) NOT NULL,
        [Name] nvarchar(150) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_CustomerCategories] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CustomerCategories_Code' AND object_id = OBJECT_ID(N'dbo.CustomerCategories'))
    CREATE INDEX [IX_CustomerCategories_Code] ON [dbo].[CustomerCategories]([Code]);");

        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.CustomerCategoryAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CustomerCategoryAssignments](
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [CategoryId] uniqueidentifier NOT NULL,
        [AssignedAtUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_CustomerCategoryAssignments] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CustomerCategoryAssignments_CustomerId' AND object_id = OBJECT_ID(N'dbo.CustomerCategoryAssignments'))
    CREATE UNIQUE INDEX [IX_CustomerCategoryAssignments_CustomerId] ON [dbo].[CustomerCategoryAssignments]([CustomerId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CustomerCategoryAssignments_CustomerId_CategoryId' AND object_id = OBJECT_ID(N'dbo.CustomerCategoryAssignments'))
    CREATE INDEX [IX_CustomerCategoryAssignments_CustomerId_CategoryId] ON [dbo].[CustomerCategoryAssignments]([CustomerId],[CategoryId]);");

        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.CategoryPriceRules', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CategoryPriceRules](
        [Id] uniqueidentifier NOT NULL,
        [CompanyId] uniqueidentifier NULL,
        [CategoryId] uniqueidentifier NOT NULL,
        [ProductId] uniqueidentifier NULL,
        [ProductGroup] nvarchar(120) NULL,
        [FixedPrice] decimal(18,2) NULL,
        [DiscountPercent] decimal(5,2) NULL,
        [ValidFrom] datetime2 NOT NULL,
        [ValidTo] datetime2 NOT NULL,
        [Priority] int NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_CategoryPriceRules] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CategoryPriceRules_CategoryId_ProductId_IsActive' AND object_id = OBJECT_ID(N'dbo.CategoryPriceRules'))
    CREATE INDEX [IX_CategoryPriceRules_CategoryId_ProductId_IsActive] ON [dbo].[CategoryPriceRules]([CategoryId],[ProductId],[IsActive]);");

        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.CustomerPriceRules', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[CustomerPriceRules](
        [Id] uniqueidentifier NOT NULL,
        [CustomerId] uniqueidentifier NOT NULL,
        [ProductId] uniqueidentifier NOT NULL,
        [FixedPrice] decimal(18,2) NULL,
        [DiscountPercent] decimal(5,2) NULL,
        [ValidFrom] datetime2 NOT NULL,
        [ValidTo] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        CONSTRAINT [PK_CustomerPriceRules] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_CustomerPriceRules_CustomerId_ProductId_IsActive' AND object_id = OBJECT_ID(N'dbo.CustomerPriceRules'))
    CREATE INDEX [IX_CustomerPriceRules_CustomerId_ProductId_IsActive] ON [dbo].[CustomerPriceRules]([CustomerId],[ProductId],[IsActive]);");

        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.Purchases', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Purchases](
        [Id] uniqueidentifier NOT NULL,
        [CompanyId] uniqueidentifier NULL,
        [PurchaseNumber] nvarchar(60) NOT NULL,
        [PurchaseDate] datetime2 NOT NULL,
        [SupplierName] nvarchar(200) NOT NULL,
        [SubTotal] decimal(18,2) NOT NULL,
        [TaxAmount] decimal(18,2) NOT NULL,
        [GrandTotal] decimal(18,2) NOT NULL,
        [Status] nvarchar(30) NOT NULL,
        CONSTRAINT [PK_Purchases] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Purchases_PurchaseNumber' AND object_id = OBJECT_ID(N'dbo.Purchases'))
    CREATE UNIQUE INDEX [IX_Purchases_PurchaseNumber] ON [dbo].[Purchases]([PurchaseNumber]);");

        migrationBuilder.Sql(@"
IF OBJECT_ID(N'dbo.PurchaseLines', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PurchaseLines](
        [Id] uniqueidentifier NOT NULL,
        [PurchaseId] uniqueidentifier NOT NULL,
        [ProductId] uniqueidentifier NOT NULL,
        [Quantity] decimal(18,3) NOT NULL,
        [UnitCost] decimal(18,2) NOT NULL,
        [TaxAmount] decimal(18,2) NOT NULL,
        [LineTotal] decimal(18,2) NOT NULL,
        CONSTRAINT [PK_PurchaseLines] PRIMARY KEY ([Id])
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PurchaseLines_PurchaseId' AND object_id = OBJECT_ID(N'dbo.PurchaseLines'))
    CREATE INDEX [IX_PurchaseLines_PurchaseId] ON [dbo].[PurchaseLines]([PurchaseId]);");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Intentionally non-destructive: this repair migration must never remove
        // enterprise tables or any data created after v1.1 was deployed.
    }
}
