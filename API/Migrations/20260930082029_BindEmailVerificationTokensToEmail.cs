using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class BindEmailVerificationTokensToEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "EMAIL_VERIFICATION_TOKEN",
                type: "varchar(320)",
                nullable: false,
                defaultValue: "");

            // Legacy tokens were not bound to an address. Require a fresh verification email.
            migrationBuilder.Sql("UPDATE \"EMAIL_VERIFICATION_TOKEN\" SET \"UsedAt\" = CURRENT_TIMESTAMP WHERE \"UsedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Email",
                table: "EMAIL_VERIFICATION_TOKEN");
        }
    }
}
