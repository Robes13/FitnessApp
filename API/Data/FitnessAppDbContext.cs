using FitnessApp.Api.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Data;

public class FitnessAppDbContext(DbContextOptions<FitnessAppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserProfile> UserProfiles => Set<UserProfile>();
    public DbSet<UserGoal> UserGoals => Set<UserGoal>();
    public DbSet<UserSetting> UserSettings => Set<UserSetting>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<EmailVerificationToken> EmailVerificationTokens => Set<EmailVerificationToken>();
    public DbSet<UserConsent> UserConsents => Set<UserConsent>();
    public DbSet<UserDevice> UserDevices => Set<UserDevice>();
    public DbSet<ReminderDelivery> ReminderDeliveries => Set<ReminderDelivery>();
    public DbSet<Food> Foods => Set<Food>();
    public DbSet<FoodServing> FoodServings => Set<FoodServing>();
    public DbSet<FoodLog> FoodLogs => Set<FoodLog>();
    public DbSet<MealCollection> MealCollections => Set<MealCollection>();
    public DbSet<MealItem> MealItems => Set<MealItem>();
    public DbSet<WeightLog> WeightLogs => Set<WeightLog>();
    public DbSet<Reminder> Reminders => Set<Reminder>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();
    public DbSet<LogEntry> LogEntries => Set<LogEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        ConfigureUser(modelBuilder);
        ConfigureUserProfile(modelBuilder);
        ConfigureUserGoal(modelBuilder);
        ConfigureUserSetting(modelBuilder);
        ConfigureRefreshToken(modelBuilder);
        ConfigurePasswordResetToken(modelBuilder);
        ConfigureEmailVerificationToken(modelBuilder);
        ConfigureUserConsent(modelBuilder);
        ConfigureUserDevice(modelBuilder);
        ConfigureFood(modelBuilder);
        ConfigureFoodServing(modelBuilder);
        ConfigureFoodLog(modelBuilder);
        ConfigureMealCollection(modelBuilder);
        ConfigureMealItem(modelBuilder);
        ConfigureWeightLog(modelBuilder);
        ConfigureReminder(modelBuilder);
        ConfigureReminderDelivery(modelBuilder);
        ConfigureUserAchievement(modelBuilder);
        ConfigureLogEntry(modelBuilder);
    }

    private static void ConfigureUser(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<User>();
        entity.ToTable("USER");
        entity.HasKey(x => x.UserId);
        entity.Property(x => x.Email).HasColumnType("varchar(320)").IsRequired();
        entity.Property(x => x.Username).HasColumnType("varchar(50)").IsRequired();
        entity.Property(x => x.NormalizedUsername).HasColumnType("varchar(50)")
            .HasComputedColumnSql("translate(\"Username\", 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')", stored: true);
        entity.HasIndex(x => x.NormalizedUsername).IsUnique();
        entity.Property(x => x.PasswordHash).HasColumnType("varchar(500)").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.EmailVerifiedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.DeletedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => x.Email).IsUnique();
        entity.HasIndex(x => x.Username).IsUnique();
    }

    private static void ConfigureUserProfile(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<UserProfile>();
        entity.ToTable("USER_PROFILE");
        entity.HasKey(x => x.UserProfileId);
        entity.Property(x => x.BirthDate).HasColumnType("date");
        entity.Property(x => x.Gender).HasConversion<int>();
        entity.Property(x => x.Height).HasPrecision(5, 2);
        entity.Property(x => x.StartingWeight).HasPrecision(5, 2);
        entity.Property(x => x.TimeZoneId).HasColumnType("varchar(100)").IsRequired();
        entity.Property(x => x.ProfileImagePath).HasColumnType("varchar(500)");
        entity.Property(x => x.TrainingIntensity).HasConversion<int>();
        entity.HasIndex(x => x.UserId).IsUnique();
        entity.HasOne(x => x.User)
            .WithOne(x => x.UserProfile)
            .HasForeignKey<UserProfile>(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureUserGoal(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<UserGoal>();
        entity.ToTable("USER_GOAL");
        entity.HasKey(x => x.UserGoalId);
        entity.Property(x => x.GoalType).HasConversion<int>();
        entity.Property(x => x.TargetWeight).HasPrecision(5, 2);
        entity.Property(x => x.WeightChangePerWeek).HasPrecision(4, 2);
        entity.Property(x => x.TargetDailyCalories).HasPrecision(7, 2);
        entity.Property(x => x.TargetProtein).HasPrecision(7, 2);
        entity.Property(x => x.TargetCarbohydrates).HasPrecision(7, 2);
        entity.Property(x => x.TargetFat).HasPrecision(7, 2);
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.CreatedAt, x.UserGoalId })
            .IsDescending(false, true, true);
        entity.HasOne(x => x.User)
            .WithMany(x => x.UserGoals)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureUserSetting(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<UserSetting>();
        entity.ToTable("USER_SETTING");
        entity.HasKey(x => x.UserSettingId);
        entity.Property(x => x.SettingKey).HasConversion<int>();
        entity.Property(x => x.SettingValue).HasColumnType("varchar(500)").IsRequired();
        entity.Property(x => x.UpdatedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.SettingKey }).IsUnique();
        entity.HasOne(x => x.User)
            .WithMany(x => x.UserSettings)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureRefreshToken(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<RefreshToken>();
        entity.ToTable("REFRESH_TOKEN");
        entity.HasKey(x => x.TokenId);
        entity.Property(x => x.TokenId).HasColumnType("varchar(100)");
        entity.Property(x => x.State).HasConversion<int>();
        entity.HasIndex(x => x.UserId);
        entity.HasOne(x => x.User)
            .WithMany(x => x.RefreshTokens)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigurePasswordResetToken(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<PasswordResetToken>();
        entity.ToTable("PASSWORD_RESET_TOKEN");
        entity.HasKey(x => x.TokenId);
        entity.Property(x => x.TokenId).HasColumnType("varchar(100)");
        entity.Property(x => x.ExpiresAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.State).HasConversion<int>();
        entity.HasIndex(x => x.UserId);
        entity.HasOne(x => x.User)
            .WithMany(x => x.PasswordResetTokens)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureEmailVerificationToken(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<EmailVerificationToken>();
        entity.ToTable("EMAIL_VERIFICATION_TOKEN");
        entity.Property(x => x.Email).HasColumnType("varchar(320)").IsRequired();
        entity.HasKey(x => x.EmailVerificationTokenId);
        entity.Property(x => x.TokenHash).HasColumnType("varchar(64)").IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.UsedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.NewEmail).HasColumnType("varchar(320)");
        entity.HasIndex(x => x.TokenHash).IsUnique();
        entity.HasIndex(x => x.UserId);
        entity.HasOne(x => x.User).WithMany(x => x.EmailVerificationTokens)
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureUserConsent(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<UserConsent>();
        entity.ToTable("USER_CONSENT");
        entity.HasKey(x => x.UserConsentId);
        entity.Property(x => x.ConsentType).HasConversion<int>();
        entity.Property(x => x.DocumentVersion).HasColumnType("varchar(50)").IsRequired();
        entity.Property(x => x.GrantedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.WithdrawnAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.ConsentType, x.GrantedAt });
        entity.HasOne(x => x.User).WithMany(x => x.UserConsents)
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureUserDevice(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<UserDevice>();
        entity.ToTable("USER_DEVICE");
        entity.HasKey(x => x.UserDeviceId);
        entity.Property(x => x.TokenHash).HasColumnType("varchar(64)").IsRequired();
        entity.Property(x => x.ProtectedToken).HasColumnType("text").IsRequired();
        entity.Property(x => x.Platform).HasConversion<int>();
        entity.Property(x => x.RegisteredAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => x.TokenHash).IsUnique();
        entity.HasIndex(x => x.UserId);
        entity.HasOne(x => x.User).WithMany(x => x.UserDevices)
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureReminderDelivery(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<ReminderDelivery>();
        entity.ToTable("REMINDER_DELIVERY");
        entity.HasKey(x => x.ReminderDeliveryId);
        entity.Property(x => x.ScheduledFor).HasColumnType("timestamp with time zone");
        entity.Property(x => x.SentAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.ClaimedUntil).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.ReminderId, x.ScheduledFor }).IsUnique();
        entity.HasOne(x => x.Reminder).WithMany(x => x.Deliveries)
            .HasForeignKey(x => x.ReminderId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureFood(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<Food>();
        entity.ToTable("FOOD");
        entity.HasKey(x => x.FoodId);
        entity.Property(x => x.Name).HasColumnType("varchar(150)").IsRequired();
        entity.Property(x => x.Barcode).HasColumnType("varchar(100)");
        entity.Property(x => x.CaloriesPer100).HasPrecision(7, 2);
        entity.Property(x => x.ProteinPer100).HasPrecision(7, 2);
        entity.Property(x => x.CarbohydratesPer100).HasPrecision(7, 2);
        entity.Property(x => x.FatPer100).HasPrecision(7, 2);
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => x.Barcode);
        entity.HasIndex(x => new { x.Name, x.FoodId });
        entity.HasOne(x => x.CreatedByUser)
            .WithMany(x => x.CreatedFoods)
            .HasForeignKey(x => x.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureFoodServing(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<FoodServing>();
        entity.ToTable("FOOD_SERVING");
        entity.HasKey(x => x.FoodServingId);
        entity.Property(x => x.Unit).HasConversion<int>();
        entity.Property(x => x.GramsPerUnit).HasPrecision(7, 2);
        entity.HasIndex(x => new { x.FoodId, x.Unit }).IsUnique();
        entity.HasOne(x => x.Food)
            .WithMany(x => x.Servings)
            .HasForeignKey(x => x.FoodId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureFoodLog(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<FoodLog>();
        entity.ToTable("FOOD_LOG");
        entity.HasKey(x => x.FoodLogId);
        entity.Property(x => x.Quantity).HasPrecision(9, 2);
        entity.Property(x => x.Unit).HasConversion<int>();
        entity.Property(x => x.MealType).HasConversion<int>();
        entity.Property(x => x.CaloriesConsumed).HasPrecision(7, 2);
        entity.Property(x => x.ProteinConsumed).HasPrecision(7, 2);
        entity.Property(x => x.CarbohydratesConsumed).HasPrecision(7, 2);
        entity.Property(x => x.FatConsumed).HasPrecision(7, 2);
        entity.Property(x => x.ConsumedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.DeletedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.ConsumedAt, x.FoodLogId })
            .IsDescending(false, true, true);
        entity.HasOne(x => x.User)
            .WithMany(x => x.FoodLogs)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Food)
            .WithMany(x => x.FoodLogs)
            .HasForeignKey(x => x.FoodId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureMealCollection(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<MealCollection>();
        entity.ToTable("MEAL_COLLECTION");
        entity.HasKey(x => x.MealCollectionId);
        entity.Property(x => x.Name).HasColumnType("varchar(100)").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.CreatedAt, x.MealCollectionId })
            .IsDescending(false, true, true);
        entity.HasOne(x => x.User)
            .WithMany(x => x.MealCollections)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureMealItem(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<MealItem>();
        entity.ToTable("MEAL_ITEM");
        entity.HasKey(x => x.MealItemId);
        entity.Property(x => x.Quantity).HasPrecision(9, 2);
        entity.Property(x => x.Unit).HasConversion<int>();
        entity.HasIndex(x => x.MealCollectionId);
        entity.HasOne(x => x.MealCollection)
            .WithMany(x => x.Items)
            .HasForeignKey(x => x.MealCollectionId)
            .OnDelete(DeleteBehavior.Cascade);
        entity.HasOne(x => x.Food)
            .WithMany(x => x.MealItems)
            .HasForeignKey(x => x.FoodId)
            .OnDelete(DeleteBehavior.Restrict);
    }

    private static void ConfigureWeightLog(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<WeightLog>();
        entity.ToTable("WEIGHT_LOG");
        entity.HasKey(x => x.WeightLogId);
        entity.Property(x => x.Weight).HasPrecision(5, 2);
        entity.Property(x => x.RecordedAt).HasColumnType("timestamp with time zone");
        entity.Property(x => x.RecordedDate).HasColumnType("date");
        entity.HasIndex(x => new { x.UserId, x.RecordedDate }).IsUnique();
        entity.HasIndex(x => new { x.UserId, x.RecordedAt, x.WeightLogId })
            .IsDescending(false, true, true);
        entity.HasOne(x => x.User)
            .WithMany(x => x.WeightLogs)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureReminder(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<Reminder>();
        entity.ToTable("REMINDER");
        entity.HasKey(x => x.ReminderId);
        entity.Property(x => x.ReminderType).HasConversion<int>();
        entity.Property(x => x.ReminderTime).HasColumnType("time without time zone");
        entity.HasIndex(x => x.UserId);
        entity.HasOne(x => x.User)
            .WithMany(x => x.Reminders)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureUserAchievement(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<UserAchievement>();
        entity.ToTable("USER_ACHIEVEMENT");
        entity.HasKey(x => x.UserAchievementId);
        entity.Property(x => x.AchievementType).HasConversion<int>();
        entity.Property(x => x.CompletedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.AchievementType }).IsUnique();
        entity.HasOne(x => x.User)
            .WithMany(x => x.UserAchievements)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureLogEntry(ModelBuilder modelBuilder)
    {
        var entity = modelBuilder.Entity<LogEntry>();
        entity.ToTable("LOG_ENTRY");
        entity.HasKey(x => x.LogEntryId);
        entity.Property(x => x.MethodName).HasColumnType("varchar(200)");
        entity.Property(x => x.Message).HasColumnType("varchar(2000)").IsRequired();
        entity.Property(x => x.Parameters).HasColumnType("jsonb");
        entity.Property(x => x.Exception).HasColumnType("varchar(8000)");
        entity.Property(x => x.RequestPath).HasColumnType("varchar(500)");
        entity.Property(x => x.HttpMethod).HasColumnType("varchar(16)");
        entity.Property(x => x.CorrelationId).HasColumnType("varchar(100)");
        entity.Property(x => x.CreatedAt).HasColumnType("timestamp with time zone");
        entity.HasIndex(x => new { x.UserId, x.CreatedAt, x.LogEntryId })
            .IsDescending(false, true, true);
        entity.HasIndex(x => x.CorrelationId);
        entity.HasOne(x => x.User)
            .WithMany(x => x.LogEntries)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
