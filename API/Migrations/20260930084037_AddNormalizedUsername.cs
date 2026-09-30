using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddNormalizedUsername : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Abort rather than silently rename accounts or merge case-colliding identities.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "USER" WHERE "Username" IS NULL OR "Username" = '') THEN
                        RAISE EXCEPTION 'Username migration requires every account to have a username. Resolve missing names before retrying.';
                    END IF;
                    IF EXISTS (SELECT 1 FROM "USER"
                        GROUP BY translate("Username", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')
                        HAVING count(*) > 1) THEN
                        RAISE EXCEPTION 'Username migration found case-insensitive collisions. Resolve account usernames before retrying.';
                    END IF;
                END $$;
                """);

            migrationBuilder.AddColumn<string>(
                name: "NormalizedUsername",
                table: "USER",
                type: "varchar(50)",
                nullable: false,
                computedColumnSql: "translate(\"Username\", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')",
                stored: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_NormalizedUsername",
                table: "USER",
                column: "NormalizedUsername",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_USER_NormalizedUsername",
                table: "USER");

            migrationBuilder.DropColumn(
                name: "NormalizedUsername",
                table: "USER");
        }
    }
}
