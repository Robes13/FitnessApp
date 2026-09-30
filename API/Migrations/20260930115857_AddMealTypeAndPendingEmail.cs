using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FitnessApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMealTypeAndPendingEmail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MealType",
                table: "FOOD_LOG",
                type: "integer",
                nullable: false,
                defaultValue: 4); // Snack: 0 is not a valid MealType

            migrationBuilder.AddColumn<string>(
                name: "NewEmail",
                table: "EMAIL_VERIFICATION_TOKEN",
                type: "varchar(320)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MealType",
                table: "FOOD_LOG");

            migrationBuilder.DropColumn(
                name: "NewEmail",
                table: "EMAIL_VERIFICATION_TOKEN");
        }
    }
}
