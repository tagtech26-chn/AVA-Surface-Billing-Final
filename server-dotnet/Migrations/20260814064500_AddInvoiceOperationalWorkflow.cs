using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations;

public partial class AddInvoiceOperationalWorkflow : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "WorkflowStatus", table: "Invoices", type: "nvarchar(40)", maxLength: 40, nullable: false, defaultValue: "PAYMENT_PENDING");
        migrationBuilder.AddColumn<Guid>(name: "PaymentConfirmedByUserId", table: "Invoices", type: "uniqueidentifier", nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentConfirmedByName", table: "Invoices", type: "nvarchar(150)", maxLength: 150, nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "PaymentConfirmedAtUtc", table: "Invoices", type: "datetime2", nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentMethodConfirmed", table: "Invoices", type: "nvarchar(30)", maxLength: 30, nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentSpecificReference", table: "Invoices", type: "nvarchar(200)", maxLength: 200, nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentBankName", table: "Invoices", type: "nvarchar(150)", maxLength: 150, nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentCardLast4", table: "Invoices", type: "nvarchar(4)", maxLength: 4, nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentUtr", table: "Invoices", type: "nvarchar(100)", maxLength: 100, nullable: true);
        migrationBuilder.AddColumn<string>(name: "PaymentRemarks", table: "Invoices", type: "nvarchar(500)", maxLength: 500, nullable: true);
        migrationBuilder.AddColumn<string>(name: "WarehouseLoadedBy", table: "Invoices", type: "nvarchar(150)", maxLength: 150, nullable: true);
        migrationBuilder.AddColumn<string>(name: "WarehouseVerifiedBy", table: "Invoices", type: "nvarchar(150)", maxLength: 150, nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "WarehouseLoadedAtUtc", table: "Invoices", type: "datetime2", nullable: true);
        migrationBuilder.AddColumn<string>(name: "WarehouseVehicleNumber", table: "Invoices", type: "nvarchar(30)", maxLength: 30, nullable: true);
        migrationBuilder.AddColumn<string>(name: "WarehouseRemarks", table: "Invoices", type: "nvarchar(500)", maxLength: 500, nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "DeliveredAtUtc", table: "Invoices", type: "datetime2", nullable: true);
        migrationBuilder.AddColumn<string>(name: "DeliveredByName", table: "Invoices", type: "nvarchar(150)", maxLength: 150, nullable: true);
        migrationBuilder.AddColumn<string>(name: "DeliveryRemarks", table: "Invoices", type: "nvarchar(500)", maxLength: 500, nullable: true);

        migrationBuilder.CreateIndex(name: "IX_Invoices_CompanyId_WorkflowStatus_InvoiceDate", table: "Invoices", columns: new[] { "CompanyId", "WorkflowStatus", "InvoiceDate" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_Invoices_CompanyId_WorkflowStatus_InvoiceDate", table: "Invoices");
        migrationBuilder.DropColumn(name: "WorkflowStatus", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentConfirmedByUserId", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentConfirmedByName", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentConfirmedAtUtc", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentMethodConfirmed", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentSpecificReference", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentBankName", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentCardLast4", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentUtr", table: "Invoices");
        migrationBuilder.DropColumn(name: "PaymentRemarks", table: "Invoices");
        migrationBuilder.DropColumn(name: "WarehouseLoadedBy", table: "Invoices");
        migrationBuilder.DropColumn(name: "WarehouseVerifiedBy", table: "Invoices");
        migrationBuilder.DropColumn(name: "WarehouseLoadedAtUtc", table: "Invoices");
        migrationBuilder.DropColumn(name: "WarehouseVehicleNumber", table: "Invoices");
        migrationBuilder.DropColumn(name: "WarehouseRemarks", table: "Invoices");
        migrationBuilder.DropColumn(name: "DeliveredAtUtc", table: "Invoices");
        migrationBuilder.DropColumn(name: "DeliveredByName", table: "Invoices");
        migrationBuilder.DropColumn(name: "DeliveryRemarks", table: "Invoices");
    }
}
