using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPushDevicesAndDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "REMINDER_DELIVERY",
                columns: table => new
                {
                    ReminderDeliveryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ReminderId = table.Column<int>(type: "integer", nullable: false),
                    ScheduledFor = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClaimId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClaimedUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_REMINDER_DELIVERY", x => x.ReminderDeliveryId);
                    table.ForeignKey(
                        name: "FK_REMINDER_DELIVERY_REMINDER_ReminderId",
                        column: x => x.ReminderId,
                        principalTable: "REMINDER",
                        principalColumn: "ReminderId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_DEVICE",
                columns: table => new
                {
                    UserDeviceId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "varchar(64)", nullable: false),
                    ProtectedToken = table.Column<string>(type: "text", nullable: false),
                    Platform = table.Column<int>(type: "integer", nullable: false),
                    RegisteredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_DEVICE", x => x.UserDeviceId);
                    table.ForeignKey(
                        name: "FK_USER_DEVICE_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_REMINDER_DELIVERY_ReminderId_ScheduledFor",
                table: "REMINDER_DELIVERY",
                columns: new[] { "ReminderId", "ScheduledFor" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_DEVICE_TokenHash",
                table: "USER_DEVICE",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_DEVICE_UserId",
                table: "USER_DEVICE",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "REMINDER_DELIVERY");

            migrationBuilder.DropTable(
                name: "USER_DEVICE");
        }
    }
}
