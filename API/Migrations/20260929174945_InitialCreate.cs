using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FitnessApp.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "USER",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Email = table.Column<string>(type: "varchar(320)", nullable: false),
                    Username = table.Column<string>(type: "varchar(50)", nullable: false),
                    PasswordHash = table.Column<string>(type: "varchar(500)", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    EmailVerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER", x => x.UserId);
                });

            migrationBuilder.CreateTable(
                name: "EMAIL_VERIFICATION_TOKEN",
                columns: table => new
                {
                    EmailVerificationTokenId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    TokenHash = table.Column<string>(type: "varchar(64)", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EMAIL_VERIFICATION_TOKEN", x => x.EmailVerificationTokenId);
                    table.ForeignKey(
                        name: "FK_EMAIL_VERIFICATION_TOKEN_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FOOD",
                columns: table => new
                {
                    FoodId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "varchar(150)", nullable: false),
                    Barcode = table.Column<string>(type: "varchar(100)", nullable: true),
                    CaloriesPer100 = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    ProteinPer100 = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    CarbohydratesPer100 = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    FatPer100 = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FOOD", x => x.FoodId);
                    table.ForeignKey(
                        name: "FK_FOOD_USER_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LOG_ENTRY",
                columns: table => new
                {
                    LogEntryId = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    MethodName = table.Column<string>(type: "varchar(200)", nullable: true),
                    Message = table.Column<string>(type: "varchar(2000)", nullable: false),
                    Parameters = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    Exception = table.Column<string>(type: "varchar(8000)", nullable: true),
                    RequestPath = table.Column<string>(type: "varchar(500)", nullable: true),
                    HttpMethod = table.Column<string>(type: "varchar(16)", nullable: true),
                    CorrelationId = table.Column<string>(type: "varchar(100)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LOG_ENTRY", x => x.LogEntryId);
                    table.ForeignKey(
                        name: "FK_LOG_ENTRY_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MEAL_COLLECTION",
                columns: table => new
                {
                    MealCollectionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Name = table.Column<string>(type: "varchar(100)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MEAL_COLLECTION", x => x.MealCollectionId);
                    table.ForeignKey(
                        name: "FK_MEAL_COLLECTION_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PASSWORD_RESET_TOKEN",
                columns: table => new
                {
                    TokenId = table.Column<string>(type: "varchar(100)", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PASSWORD_RESET_TOKEN", x => x.TokenId);
                    table.ForeignKey(
                        name: "FK_PASSWORD_RESET_TOKEN_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "REFRESH_TOKEN",
                columns: table => new
                {
                    TokenId = table.Column<string>(type: "varchar(100)", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    State = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_REFRESH_TOKEN", x => x.TokenId);
                    table.ForeignKey(
                        name: "FK_REFRESH_TOKEN_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "REMINDER",
                columns: table => new
                {
                    ReminderId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ReminderType = table.Column<int>(type: "integer", nullable: false),
                    ReminderTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    IsEnabled = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_REMINDER", x => x.ReminderId);
                    table.ForeignKey(
                        name: "FK_REMINDER_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_ACHIEVEMENT",
                columns: table => new
                {
                    UserAchievementId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    AchievementType = table.Column<int>(type: "integer", nullable: false),
                    Progress = table.Column<int>(type: "integer", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_ACHIEVEMENT", x => x.UserAchievementId);
                    table.ForeignKey(
                        name: "FK_USER_ACHIEVEMENT_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_CONSENT",
                columns: table => new
                {
                    UserConsentId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    ConsentType = table.Column<int>(type: "integer", nullable: false),
                    DocumentVersion = table.Column<string>(type: "varchar(50)", nullable: false),
                    GrantedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    WithdrawnAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_CONSENT", x => x.UserConsentId);
                    table.ForeignKey(
                        name: "FK_USER_CONSENT_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_GOAL",
                columns: table => new
                {
                    UserGoalId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    GoalType = table.Column<int>(type: "integer", nullable: false),
                    TargetWeight = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    WeightChangePerWeek = table.Column<decimal>(type: "numeric(4,2)", precision: 4, scale: 2, nullable: false),
                    TargetDailyCalories = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    TargetProtein = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    TargetCarbohydrates = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    TargetFat = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_GOAL", x => x.UserGoalId);
                    table.ForeignKey(
                        name: "FK_USER_GOAL_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_PROFILE",
                columns: table => new
                {
                    UserProfileId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    BirthDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Gender = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    StartingWeight = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    TimeZoneId = table.Column<string>(type: "varchar(100)", nullable: false),
                    ProfileImagePath = table.Column<string>(type: "varchar(500)", nullable: true),
                    DailySteps = table.Column<int>(type: "integer", nullable: false),
                    TrainingDaysPerWeek = table.Column<int>(type: "integer", nullable: false),
                    WorkoutDurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    TrainingIntensity = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_PROFILE", x => x.UserProfileId);
                    table.ForeignKey(
                        name: "FK_USER_PROFILE_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "USER_SETTING",
                columns: table => new
                {
                    UserSettingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    SettingKey = table.Column<int>(type: "integer", nullable: false),
                    SettingValue = table.Column<string>(type: "varchar(500)", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_SETTING", x => x.UserSettingId);
                    table.ForeignKey(
                        name: "FK_USER_SETTING_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WEIGHT_LOG",
                columns: table => new
                {
                    WeightLogId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    Weight = table.Column<decimal>(type: "numeric(5,2)", precision: 5, scale: 2, nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RecordedDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WEIGHT_LOG", x => x.WeightLogId);
                    table.ForeignKey(
                        name: "FK_WEIGHT_LOG_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FOOD_LOG",
                columns: table => new
                {
                    FoodLogId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<int>(type: "integer", nullable: false),
                    FoodId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(9,2)", precision: 9, scale: 2, nullable: false),
                    Unit = table.Column<int>(type: "integer", nullable: false),
                    CaloriesConsumed = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    ProteinConsumed = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    CarbohydratesConsumed = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    FatConsumed = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false),
                    ConsumedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FOOD_LOG", x => x.FoodLogId);
                    table.ForeignKey(
                        name: "FK_FOOD_LOG_FOOD_FoodId",
                        column: x => x.FoodId,
                        principalTable: "FOOD",
                        principalColumn: "FoodId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FOOD_LOG_USER_UserId",
                        column: x => x.UserId,
                        principalTable: "USER",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FOOD_SERVING",
                columns: table => new
                {
                    FoodServingId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    FoodId = table.Column<int>(type: "integer", nullable: false),
                    Unit = table.Column<int>(type: "integer", nullable: false),
                    GramsPerUnit = table.Column<decimal>(type: "numeric(7,2)", precision: 7, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FOOD_SERVING", x => x.FoodServingId);
                    table.ForeignKey(
                        name: "FK_FOOD_SERVING_FOOD_FoodId",
                        column: x => x.FoodId,
                        principalTable: "FOOD",
                        principalColumn: "FoodId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MEAL_ITEM",
                columns: table => new
                {
                    MealItemId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    MealCollectionId = table.Column<int>(type: "integer", nullable: false),
                    FoodId = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<decimal>(type: "numeric(9,2)", precision: 9, scale: 2, nullable: false),
                    Unit = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MEAL_ITEM", x => x.MealItemId);
                    table.ForeignKey(
                        name: "FK_MEAL_ITEM_FOOD_FoodId",
                        column: x => x.FoodId,
                        principalTable: "FOOD",
                        principalColumn: "FoodId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MEAL_ITEM_MEAL_COLLECTION_MealCollectionId",
                        column: x => x.MealCollectionId,
                        principalTable: "MEAL_COLLECTION",
                        principalColumn: "MealCollectionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_VERIFICATION_TOKEN_TokenHash",
                table: "EMAIL_VERIFICATION_TOKEN",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EMAIL_VERIFICATION_TOKEN_UserId",
                table: "EMAIL_VERIFICATION_TOKEN",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FOOD_Barcode",
                table: "FOOD",
                column: "Barcode");

            migrationBuilder.CreateIndex(
                name: "IX_FOOD_CreatedByUserId",
                table: "FOOD",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FOOD_Name_FoodId",
                table: "FOOD",
                columns: new[] { "Name", "FoodId" });

            migrationBuilder.CreateIndex(
                name: "IX_FOOD_LOG_FoodId",
                table: "FOOD_LOG",
                column: "FoodId");

            migrationBuilder.CreateIndex(
                name: "IX_FOOD_LOG_UserId_ConsumedAt_FoodLogId",
                table: "FOOD_LOG",
                columns: new[] { "UserId", "ConsumedAt", "FoodLogId" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_FOOD_SERVING_FoodId_Unit",
                table: "FOOD_SERVING",
                columns: new[] { "FoodId", "Unit" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LOG_ENTRY_CorrelationId",
                table: "LOG_ENTRY",
                column: "CorrelationId");

            migrationBuilder.CreateIndex(
                name: "IX_LOG_ENTRY_UserId_CreatedAt_LogEntryId",
                table: "LOG_ENTRY",
                columns: new[] { "UserId", "CreatedAt", "LogEntryId" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_MEAL_COLLECTION_UserId_CreatedAt_MealCollectionId",
                table: "MEAL_COLLECTION",
                columns: new[] { "UserId", "CreatedAt", "MealCollectionId" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_MEAL_ITEM_FoodId",
                table: "MEAL_ITEM",
                column: "FoodId");

            migrationBuilder.CreateIndex(
                name: "IX_MEAL_ITEM_MealCollectionId",
                table: "MEAL_ITEM",
                column: "MealCollectionId");

            migrationBuilder.CreateIndex(
                name: "IX_PASSWORD_RESET_TOKEN_UserId",
                table: "PASSWORD_RESET_TOKEN",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_REFRESH_TOKEN_UserId",
                table: "REFRESH_TOKEN",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_REMINDER_UserId",
                table: "REMINDER",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_USER_Email",
                table: "USER",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_Username",
                table: "USER",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_ACHIEVEMENT_UserId_AchievementType",
                table: "USER_ACHIEVEMENT",
                columns: new[] { "UserId", "AchievementType" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_CONSENT_UserId_ConsentType_GrantedAt",
                table: "USER_CONSENT",
                columns: new[] { "UserId", "ConsentType", "GrantedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_USER_GOAL_UserId_CreatedAt_UserGoalId",
                table: "USER_GOAL",
                columns: new[] { "UserId", "CreatedAt", "UserGoalId" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_USER_PROFILE_UserId",
                table: "USER_PROFILE",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_SETTING_UserId_SettingKey",
                table: "USER_SETTING",
                columns: new[] { "UserId", "SettingKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WEIGHT_LOG_UserId_RecordedAt_WeightLogId",
                table: "WEIGHT_LOG",
                columns: new[] { "UserId", "RecordedAt", "WeightLogId" },
                descending: new[] { false, true, true });

            migrationBuilder.CreateIndex(
                name: "IX_WEIGHT_LOG_UserId_RecordedDate",
                table: "WEIGHT_LOG",
                columns: new[] { "UserId", "RecordedDate" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EMAIL_VERIFICATION_TOKEN");

            migrationBuilder.DropTable(
                name: "FOOD_LOG");

            migrationBuilder.DropTable(
                name: "FOOD_SERVING");

            migrationBuilder.DropTable(
                name: "LOG_ENTRY");

            migrationBuilder.DropTable(
                name: "MEAL_ITEM");

            migrationBuilder.DropTable(
                name: "PASSWORD_RESET_TOKEN");

            migrationBuilder.DropTable(
                name: "REFRESH_TOKEN");

            migrationBuilder.DropTable(
                name: "REMINDER");

            migrationBuilder.DropTable(
                name: "USER_ACHIEVEMENT");

            migrationBuilder.DropTable(
                name: "USER_CONSENT");

            migrationBuilder.DropTable(
                name: "USER_GOAL");

            migrationBuilder.DropTable(
                name: "USER_PROFILE");

            migrationBuilder.DropTable(
                name: "USER_SETTING");

            migrationBuilder.DropTable(
                name: "WEIGHT_LOG");

            migrationBuilder.DropTable(
                name: "FOOD");

            migrationBuilder.DropTable(
                name: "MEAL_COLLECTION");

            migrationBuilder.DropTable(
                name: "USER");
        }
    }
}
