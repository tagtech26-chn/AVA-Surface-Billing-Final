using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AVASurface.Server.Migrations;

public partial class AddAppUserPasswordHash : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "PasswordHash",
            table: "AppUsers",
            type: "nvarchar(500)",
            maxLength: 500,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "PasswordHash", table: "AppUsers");
    }
}
