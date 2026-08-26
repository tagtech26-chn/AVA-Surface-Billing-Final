using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations
{
    /// <inheritdoc />
    public partial class V1_1_EnterpriseManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
           /// migrationBuilder.CreateTable(
              ///  name: "DraftBills",
               /// columns: table => new
               /// {
               ///     Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
               ///     UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
               ///     CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
               ///     CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
               ///     CustomerPhone = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
               ///     CustomerType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
               ///     PayloadJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
               ///     SavedBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
               ///     TotalAmount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: ///false),
   ///                 TotalWeightKg = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: ///false),
   ///                 CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
      ///          },
         ///       constraints: table =>
            ///    {
               ///     table.PrimaryKey("PK_DraftBills", x => x.Id);
            ///    });

           /// migrationBuilder.CreateIndex(
            ///    name: "IX_DraftBills_UserId_CreatedAtUtc",
          ///      table: "DraftBills",
           ///     columns: new[] { "UserId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /// migrationBuilder.DropTable(
            ///    name: "DraftBills");
        }
    }
}
