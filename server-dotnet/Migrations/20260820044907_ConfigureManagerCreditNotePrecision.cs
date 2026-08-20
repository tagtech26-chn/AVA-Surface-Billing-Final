using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations
{
    /// <inheritdoc />
    public partial class ConfigureManagerCreditNotePrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CreditNoteAmount",
                table: "Invoices",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "CreditNoteFlagged",
                table: "Invoices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreditNoteFlaggedAtUtc",
                table: "Invoices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreditNoteReason",
                table: "Invoices",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CreditNoteUserId",
                table: "Invoices",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreditNoteAmount",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreditNoteFlagged",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreditNoteFlaggedAtUtc",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreditNoteReason",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "CreditNoteUserId",
                table: "Invoices");
        }
    }
}
