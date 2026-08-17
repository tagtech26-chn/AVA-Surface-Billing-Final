using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerPincode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Pincode",
                table: "Customers",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Pincode",
                table: "Customers");
        }
    }
}
