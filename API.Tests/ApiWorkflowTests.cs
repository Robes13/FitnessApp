using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Goals;
using FitnessApp.Api.DTOs.Meals;
using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.DTOs.Weights;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using FitnessApp.Api.Services.Achievements;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Services.FoodLogs;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Services.History;
using FitnessApp.Api.Services.Meals;
using FitnessApp.Api.Services.Nutrition;
using FitnessApp.Api.Services.Profiles;
using FitnessApp.Api.Services.Weights;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Tests;

public sealed class ApiWorkflowTests
{
    private static readonly DateTime Jan1 = new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task RegistrationRequiresVerificationAndRejectsDuplicateEmail()
    {
        await using var database = await TestDatabase.CreateAsync();
        var sender = new CapturingSender();
        var auth = new AuthService(database.Context, new UnusedJwtService(),
            new PasswordHasher<User>(), sender, new ConfigurationBuilder().Build(),
            TimeProvider.System, NullLogger<AuthService>.Instance);
        var request = new RegisterRequest
        {
            Email = "person@example.com", Username = "person", Password = "LongEnoughPassword1!",
            PasswordConfirmation = "LongEnoughPassword1!", BirthDate = new DateOnly(2000, 1, 1),
            Gender = Gender.Female, StartingWeight = 70m, Height = 170m, DailySteps = 5000,
            TrainingDaysPerWeek = 3, WorkoutDurationMinutes = 45,
            TrainingIntensity = TrainingIntensity.Moderate, GoalType = GoalType.MaintainWeight,
            AcceptedTerms = true, TimeZoneId = "UTC"
        };

        await auth.RegisterAsync(request, CancellationToken.None);
        var user = await database.Context.Users.SingleAsync();
        Assert.False(user.IsActive);
        Assert.Null(user.EmailVerifiedAt);
        Assert.Single(await database.Context.UserGoals.ToListAsync());
        Assert.NotEmpty(sender.Messages);
        await Assert.ThrowsAsync<UnauthorizedException>(() => auth.LoginAsync(
            new LoginRequest { Email = request.Email, Password = request.Password }, CancellationToken.None));
        await Assert.ThrowsAsync<ConflictException>(() => auth.RegisterAsync(request, CancellationToken.None));
    }

    [Fact]
    public async Task GoalsRemainHistoricalAndMatchFoodLogsAtConsumptionTime()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var food = new Food { Name = "Oats", CreatedByUserId = user.UserId,
            CaloriesPer100 = 400m, ProteinPer100 = 10m, CarbohydratesPer100 = 70m,
            FatPer100 = 5m, CreatedAt = Jan1 };
        var first = new UserGoal { UserId = user.UserId, GoalType = GoalType.MaintainWeight,
            TargetWeight = 70m, TargetDailyCalories = 2000m, TargetProtein = 100m,
            TargetCarbohydrates = 250m, TargetFat = 60m, CreatedAt = Jan1 };
        var second = new UserGoal { UserId = user.UserId, GoalType = GoalType.MaintainWeight,
            TargetWeight = 70m, TargetDailyCalories = 2200m, TargetProtein = 110m,
            TargetCarbohydrates = 275m, TargetFat = 65m, CreatedAt = Jan1.AddDays(2) };
        database.Context.AddRange(food, first, second);
        await database.Context.SaveChangesAsync();
        var achievement = new AchievementService(database.Context, TimeProvider.System);
        var foodLogs = new FoodLogService(database.Context, achievement, TimeProvider.System,
            NullLogger<FoodLogService>.Instance);
        await foodLogs.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 50m, QuantityUnit.Gram, Jan1.AddDays(1)), CancellationToken.None);
        await foodLogs.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1.AddDays(3)), CancellationToken.None);

        var nutrition = new NutritionService(database.Context, TimeProvider.System);
        var history = await nutrition.GetHistoryAsync(user.UserId, Jan1, Jan1.AddDays(5), 20,
            null, CancellationToken.None);
        Assert.Equal(2, history.Items.Count);
        Assert.Equal(second.UserGoalId, history.Items[0].GoalAtConsumption?.UserGoalId);
        Assert.Equal(first.UserGoalId, history.Items[1].GoalAtConsumption?.UserGoalId);
        Assert.Equal(400m, history.Items[0].FoodLog.CaloriesConsumed);
        Assert.Equal(200m, history.Items[1].FoodLog.CaloriesConsumed);
        var goals = new UserGoalService(database.Context, TimeProvider.System);
        Assert.Equal(first.UserGoalId,
            (await goals.GetAtAsync(user.UserId, Jan1.AddDays(1), CancellationToken.None))?.UserGoalId);
        Assert.Equal(second.UserGoalId,
            (await goals.GetCurrentAsync(user.UserId, CancellationToken.None))?.UserGoalId);
        var days = await nutrition.GetDaysAsync(user.UserId,
            new DateOnly(2026, 1, 2), new DateOnly(2026, 1, 6), CancellationToken.None);
        Assert.Equal(4, days.Count);
        Assert.Equal(0m, days[1].Consumed.Calories);
        Assert.Equal(first.UserGoalId, days[0].Goal?.UserGoalId);
        Assert.Equal(second.UserGoalId, days[2].Goal?.UserGoalId);
    }

    [Fact]
    public async Task FoodLogCursorAndRangeAreStableAndOwnerScoped()
    {
        await using var database = await TestDatabase.CreateAsync();
        var owner = await SeedUserAsync(database.Context);
        var stranger = await SeedUserAsync(database.Context, "stranger");
        var food = new Food { Name = "Rice", CreatedByUserId = owner.UserId,
            CaloriesPer100 = 100m, CreatedAt = Jan1 };
        database.Context.Foods.Add(food);
        await database.Context.SaveChangesAsync();
        var service = new FoodLogService(database.Context,
            new AchievementService(database.Context, TimeProvider.System), TimeProvider.System,
            NullLogger<FoodLogService>.Instance);
        var first = await service.CreateAsync(owner.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1), CancellationToken.None);
        await service.CreateAsync(owner.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1), CancellationToken.None);
        var page = await service.GetHistoryAsync(owner.UserId, Jan1, Jan1.AddDays(1), 1,
            null, CancellationToken.None);
        Assert.True(page.HasMore);
        var next = await service.GetHistoryAsync(owner.UserId, Jan1, Jan1.AddDays(1), 1,
            page.NextCursor, CancellationToken.None);
        Assert.Single(next.Items);
        Assert.NotEqual(page.Items[0].FoodLogId, next.Items[0].FoodLogId);
        Assert.Empty((await service.GetHistoryAsync(owner.UserId, Jan1.AddDays(1),
            Jan1.AddDays(2), 20, null, CancellationToken.None)).Items);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(
            stranger.UserId, first.FoodLogId, CancellationToken.None));
        await service.DeleteAsync(owner.UserId, first.FoodLogId, CancellationToken.None);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetAsync(
            owner.UserId, first.FoodLogId, CancellationToken.None));
    }

    [Fact]
    public async Task UnifiedHistoryCanPageWithoutRepeatingEvents()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        database.Context.UserGoals.Add(new UserGoal { UserId = user.UserId,
            GoalType = GoalType.MaintainWeight, TargetWeight = 70m,
            CreatedAt = Jan1.AddDays(1) });
        await database.Context.SaveChangesAsync();
        var service = new HistoryService(database.Context);
        var first = await service.GetAsync(user.UserId, null, null, null, 1, null, CancellationToken.None);
        var second = await service.GetAsync(user.UserId, null, null, null, 1,
            first.NextCursor, CancellationToken.None);
        Assert.True(first.HasMore);
        Assert.Single(second.Items);
        Assert.NotEqual(first.Items[0].Type, second.Items[0].Type);
    }

    [Fact]
    public async Task WeightUsesStartingValueThenAppendsGoalAndConflictsOnSameLocalDay()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        database.Context.UserGoals.Add(new UserGoal { UserId = user.UserId,
            GoalType = GoalType.MaintainWeight, TargetWeight = 70m,
            TargetDailyCalories = 2000m, CreatedAt = Jan1 });
        await database.Context.SaveChangesAsync();
        var service = new WeightLogService(database.Context,
            new UserGoalService(database.Context, TimeProvider.System),
            new AchievementService(database.Context, TimeProvider.System));
        var starting = await service.GetLatestAsync(user.UserId, CancellationToken.None);
        Assert.NotNull(starting);
        Assert.True(starting.IsStartingWeight);
        Assert.Equal(70m, starting.Weight);

        var created = await service.CreateAsync(user.UserId,
            new CreateWeightLogRequest(69m, Jan1.AddDays(5)), CancellationToken.None);
        Assert.Equal(69m, (await service.GetLatestAsync(user.UserId, CancellationToken.None))?.Weight);
        Assert.Equal(2, await database.Context.UserGoals.CountAsync());
        var conflict = await Assert.ThrowsAsync<WeightDateConflictException>(() => service.CreateAsync(
            user.UserId, new CreateWeightLogRequest(68m, Jan1.AddDays(5).AddHours(1)),
            CancellationToken.None));
        Assert.Equal(created.WeightLogId, conflict.ExistingWeightLogId);
    }

    [Fact]
    public async Task ProfileEnergyChangeAppendsGoalButUnchangedUpdateDoesNot()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        database.Context.UserGoals.Add(new UserGoal { UserId = user.UserId,
            GoalType = GoalType.MaintainWeight, TargetWeight = 70m,
            TargetDailyCalories = 2000m, CreatedAt = Jan1 });
        await database.Context.SaveChangesAsync();
        var goals = new UserGoalService(database.Context, TimeProvider.System);
        var profiles = new UserProfileService(database.Context, goals, TimeProvider.System, new FakeImageStorage());
        var changed = new UpsertUserProfileRequest(new DateOnly(2000, 1, 1),
            Gender.Female, 171m, 5000, 0, 0, TrainingIntensity.Moderate, "UTC");
        await profiles.UpsertAsync(user.UserId, changed, CancellationToken.None);
        Assert.Equal(2, await database.Context.UserGoals.CountAsync());
        await profiles.UpsertAsync(user.UserId, changed, CancellationToken.None);
        Assert.Equal(2, await database.Context.UserGoals.CountAsync());
        Assert.Equal(2000m, (await database.Context.UserGoals.OrderBy(goal => goal.UserGoalId)
            .FirstAsync()).TargetDailyCalories);
    }

    [Fact]
    public async Task SavedMealRequiresItemsAndLogsAllItemsForItsOwner()
    {
        await using var database = await TestDatabase.CreateAsync();
        var owner = await SeedUserAsync(database.Context);
        var stranger = await SeedUserAsync(database.Context, "stranger");
        var food = new Food { Name = "Bread", CreatedByUserId = owner.UserId,
            CaloriesPer100 = 250m, CreatedAt = Jan1 };
        database.Context.Foods.Add(food);
        await database.Context.SaveChangesAsync();
        var logService = new FoodLogService(database.Context,
            new AchievementService(database.Context, TimeProvider.System), TimeProvider.System,
            NullLogger<FoodLogService>.Instance);
        var meals = new MealCollectionService(database.Context, logService, TimeProvider.System);
        await Assert.ThrowsAsync<BusinessValidationException>(() => meals.CreateAsync(owner.UserId,
            new CreateMealCollectionRequest { Name = "Empty", Items = [] }, CancellationToken.None));
        var meal = await meals.CreateAsync(owner.UserId,
            new CreateMealCollectionRequest { Name = "Lunch", Items =
            [new CreateMealItemRequest(food.FoodId, 100m, QuantityUnit.Gram),
             new CreateMealItemRequest(food.FoodId, 50m, QuantityUnit.Gram)] }, CancellationToken.None);
        await Assert.ThrowsAsync<NotFoundException>(() => meals.GetAsync(stranger.UserId,
            meal.MealCollectionId, CancellationToken.None));
        var logs = await meals.LogAsync(owner.UserId, meal.MealCollectionId,
            new LogMealCollectionRequest(Jan1.AddDays(1)), CancellationToken.None);
        Assert.Equal(2, logs.Count);
        Assert.Equal(2, await database.Context.FoodLogs.CountAsync());
    }

    [Fact]
    public async Task RefreshRotatesOnceAndPasswordResetRevokesAllSessions()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        const string password = "LongEnoughPassword1!";
        var hasher = new PasswordHasher<User>();
        user.PasswordHash = hasher.HashPassword(user, password);
        await database.Context.SaveChangesAsync();
        var sender = new CapturingSender();
        var jwt = new JwtTokenService(Microsoft.Extensions.Options.Options.Create(new JwtOptions
        {
            Issuer = "test", Audience = "test", SigningKey = new string('x', 64)
        }), Microsoft.Extensions.Options.Options.Create(new RefreshTokenOptions { LifetimeDays = 30 }), TimeProvider.System);
        var auth = new AuthService(database.Context, jwt, hasher, sender,
            new ConfigurationBuilder().Build(), TimeProvider.System,
            NullLogger<AuthService>.Instance);
        var login = await auth.LoginAsync(new LoginRequest { Email = user.Email, Password = password },
            CancellationToken.None);
        var rotated = await auth.RefreshAsync(new RefreshRequest { RefreshToken = login.RefreshToken },
            CancellationToken.None);
        await Assert.ThrowsAsync<UnauthorizedException>(() => auth.RefreshAsync(
            new RefreshRequest { RefreshToken = login.RefreshToken }, CancellationToken.None));
        await auth.ForgotPasswordAsync(new ForgotPasswordRequest(user.Email), CancellationToken.None);
        var resetToken = sender.Messages.Single().Split(' ').Last();
        await auth.ResetPasswordAsync(new ResetPasswordRequest(resetToken,
            "AnotherLongPassword1!", "AnotherLongPassword1!"), CancellationToken.None);
        await Assert.ThrowsAsync<UnauthorizedException>(() => auth.RefreshAsync(
            new RefreshRequest { RefreshToken = rotated.RefreshToken }, CancellationToken.None));
    }

    [Fact]
    public void TokenLifetimesUseConfiguredValues()
    {
        var jwt = new JwtTokenService(Microsoft.Extensions.Options.Options.Create(new JwtOptions
        {
            Issuer = "test", Audience = "test", SigningKey = new string('x', 64), AccessTokenMinutes = 11
        }), Microsoft.Extensions.Options.Options.Create(new RefreshTokenOptions { LifetimeDays = 30 }), TimeProvider.System);
        var before = DateTime.UtcNow;
        var access = jwt.CreateAccessToken(1, "owner@example.com", "owner");
        var refresh = jwt.CreateRefreshToken(1);
        var after = DateTime.UtcNow;
        Assert.InRange(access.ExpiresAt, before.AddMinutes(11), after.AddMinutes(11));
        Assert.InRange(refresh.ExpiresAt, before.AddDays(30), after.AddDays(30));
    }

    [Theory]
    [InlineData("image/jpeg", ".jpg")]
    [InlineData("image/png", ".png")]
    [InlineData("image/webp", ".webp")]
    public void BlobNamesAreUniqueGuidsWithContentTypeExtensions(string contentType, string extension)
    {
        var first = AzureBlobProfileImageStorage.CreateBlobName(contentType);
        var second = AzureBlobProfileImageStorage.CreateBlobName(contentType);
        Assert.NotEqual(first, second);
        Assert.EndsWith(extension, first);
        Assert.EndsWith(extension, second);
        Assert.True(Guid.TryParseExact(first[..32], "N", out _));
        Assert.True(Guid.TryParseExact(second[..32], "N", out _));
    }

    [Fact]
    public void AzureImageUrlContainsBlobNameAndContainerSas()
    {
        var storage = new AzureBlobProfileImageStorage(Microsoft.Extensions.Options.Options.Create(new AzureBlobStorageOptions
        {
            ContainerUrl = "https://fitnessapp.blob.core.windows.net/profilepictures",
            ContainerName = "profilepictures",
            SasToken = "?si=sudo&sig=test",
            PublicBaseUrl = "https://fitnessapp.blob.core.windows.net/profilepictures"
        }));
        var key = AzureBlobProfileImageStorage.CreateBlobName("image/png");
        Assert.Equal($"https://fitnessapp.blob.core.windows.net/profilepictures/{key}?si=sudo&sig=test",
            storage.GetUrl(key));
    }

    [Fact]
    public async Task ProfileImageReplacementAndDeletionAreOwnerScoped()
    {
        await using var database = await TestDatabase.CreateAsync();
        var owner = await SeedUserAsync(database.Context);
        var stranger = await SeedUserAsync(database.Context, "stranger");
        var storage = new FakeImageStorage();
        storage.OnDelete = key => Assert.NotEqual(key,
            database.Context.UserProfiles.Single(profile => profile.UserId == owner.UserId).ProfileImagePath);
        var service = new ProfileImageService(database.Context, storage,
            Microsoft.Extensions.Options.Options.Create(new ProfileImageOptions
            {
                MaximumFileSizeBytes = 2097152,
                AllowedContentTypes = ["image/jpeg", "image/png", "image/webp"]
            }), NullLogger<ProfileImageService>.Instance);
        var bytes = new byte[] { 0xff, 0xd8, 0xff, 0x00 };
        IFormFile File() => new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "photo.jpg")
        {
            Headers = new HeaderDictionary(), ContentType = "image/jpeg"
        };
        var first = await service.UploadAsync(owner.UserId, File(), CancellationToken.None);
        var firstKey = database.Context.UserProfiles.Single(profile => profile.UserId == owner.UserId).ProfileImagePath;
        var second = await service.UploadAsync(owner.UserId, File(), CancellationToken.None);
        var secondKey = database.Context.UserProfiles.Single(profile => profile.UserId == owner.UserId).ProfileImagePath;
        Assert.NotEqual(firstKey, secondKey);
        Assert.NotEqual(first.ProfileImageUrl, second.ProfileImageUrl);
        Assert.Contains($"/profilepictures/{firstKey}?si=sudo", first.ProfileImageUrl);
        Assert.Contains($"/profilepictures/{secondKey}?si=sudo", second.ProfileImageUrl);
        Assert.Equal(new[] { firstKey!, secondKey! }, storage.Saved);
        Assert.Equal(secondKey, storage.Saved.Last());
        Assert.Contains(firstKey!, storage.Deleted);
        Assert.Equal("image/jpeg", storage.LastContentType);
        await Assert.ThrowsAsync<NotFoundException>(() => service.DeleteAsync(stranger.UserId, CancellationToken.None));
        Assert.Equal(secondKey, database.Context.UserProfiles.Single(profile => profile.UserId == owner.UserId).ProfileImagePath);
        await service.DeleteAsync(owner.UserId, CancellationToken.None);
        Assert.Contains(secondKey!, storage.Deleted);
        Assert.Null(database.Context.UserProfiles.Single(profile => profile.UserId == owner.UserId).ProfileImagePath);
    }

    [Fact]
    public async Task ProfileReturnsImageUrlOnlyWhenImageExists()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var storage = new FakeImageStorage();
        var profiles = new UserProfileService(database.Context,
            new UserGoalService(database.Context, TimeProvider.System), TimeProvider.System, storage);
        Assert.Null((await profiles.GetAsync(user.UserId, CancellationToken.None))?.ProfileImageUrl);

        var key = AzureBlobProfileImageStorage.CreateBlobName("image/webp");
        user.UserProfile!.ProfileImagePath = key;
        await database.Context.SaveChangesAsync();
        Assert.Equal(storage.GetUrl(key),
            (await profiles.GetAsync(user.UserId, CancellationToken.None))?.ProfileImageUrl);
    }

    [Fact]
    public async Task AccountDeletionRemovesItsProfileImageBlob()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var key = AzureBlobProfileImageStorage.CreateBlobName("image/png");
        user.UserProfile!.ProfileImagePath = key;
        await database.Context.SaveChangesAsync();
        var storage = new FakeImageStorage();
        var accounts = new UserAccountService(database.Context, TimeProvider.System,
            new CapturingSender(), storage, NullLogger<UserAccountService>.Instance);
        await accounts.SoftDeleteAsync(user.UserId, CancellationToken.None);
        Assert.Contains(key, storage.Deleted);
        Assert.Empty(database.Context.UserProfiles.Where(profile => profile.UserId == user.UserId));
    }

    private static async Task<User> SeedUserAsync(FitnessAppDbContext context, string name = "owner")
    {
        var user = new User { Email = $"{name}@example.com", Username = name,
            PasswordHash = "not-used", IsActive = true, EmailVerifiedAt = Jan1, CreatedAt = Jan1,
            UserProfile = new UserProfile { BirthDate = new DateOnly(2000, 1, 1),
                Gender = Gender.Female, Height = 170m, StartingWeight = 70m,
                TimeZoneId = "UTC", TrainingIntensity = TrainingIntensity.Moderate } };
        context.Users.Add(user);
        await context.SaveChangesAsync();
        return user;
    }

    private sealed class CapturingSender : IAccountMessageSender
    {
        public List<string> Messages { get; } = [];
        public Task SendAsync(string email, string subject, string message, CancellationToken cancellationToken)
        {
            Messages.Add(message);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeImageStorage : IProfileImageStorage
    {
        public List<string> Saved { get; } = [];
        public List<string> Deleted { get; } = [];
        public Action<string>? OnDelete { get; set; }
        public string? LastContentType { get; private set; }
        public Task<string> SaveAsync(byte[] content, string contentType, CancellationToken cancellationToken)
        {
            LastContentType = contentType;
            var key = AzureBlobProfileImageStorage.CreateBlobName(contentType);
            Saved.Add(key);
            return Task.FromResult(key);
        }
        public Task DeleteAsync(string key, CancellationToken cancellationToken)
        {
            OnDelete?.Invoke(key);
            Deleted.Add(key);
            return Task.CompletedTask;
        }
        public string GetUrl(string key) => $"https://fitnessapp.blob.core.windows.net/profilepictures/{key}?si=sudo&sig=test";
    }

    private sealed class UnusedJwtService : IJwtTokenService
    {
        public IssuedToken CreateAccessToken(int userId, string email, string username) => throw new NotImplementedException();
        public IssuedToken CreateRefreshToken(int userId) => throw new NotImplementedException();
        public RefreshTokenIdentity ValidateRefreshToken(string token, bool validateLifetime = true) => throw new NotImplementedException();
    }

    private sealed class TestDatabase : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public FitnessAppDbContext Context { get; }

        private TestDatabase(SqliteConnection connection, FitnessAppDbContext context)
        {
            _connection = connection;
            Context = context;
        }

        public static async Task<TestDatabase> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var context = new SqliteTestContext(new DbContextOptionsBuilder<FitnessAppDbContext>()
                .UseSqlite(connection).Options);
            await context.Database.EnsureCreatedAsync();
            return new TestDatabase(connection, context);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }

    private sealed class SqliteTestContext(DbContextOptions<FitnessAppDbContext> options)
        : FitnessAppDbContext(options)
    {
        protected override void OnModelCreating(Microsoft.EntityFrameworkCore.ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.Entity<FitnessApp.Api.Domain.Entities.LogEntry>()
                .Ignore(entry => entry.Parameters);
            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                    property.SetColumnType("TEXT");
            }
        }
    }
}
