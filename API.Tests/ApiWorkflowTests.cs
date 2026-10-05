using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using FitnessApp.Api.Controllers;
using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Foods;
using FitnessApp.Api.DTOs.Goals;
using FitnessApp.Api.DTOs.Meals;
using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.DTOs.Weights;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using FitnessApp.Api.Services.Achievements;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Services.Export;
using FitnessApp.Api.Services.FoodLogs;
using FitnessApp.Api.Services.Foods;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Services.History;
using FitnessApp.Api.Services.Meals;
using FitnessApp.Api.Services.Nutrition;
using FitnessApp.Api.Services.Profiles;
using FitnessApp.Api.Services.Weights;
using FitnessApp.Api.Utilities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Tests;

public sealed partial class ApiWorkflowTests
{
    private static readonly DateTime Jan1 = new(2026, 1, 1, 12, 0, 0, DateTimeKind.Utc);
    private const string Password = "LongEnoughPassword1!";
    private static readonly IOptions<AppOptions> AppSettings =
        Microsoft.Extensions.Options.Options.Create(new AppOptions { PublicBaseUrl = "http://localhost:5210" });

    [Fact]
    public async Task RegistrationRequiresVerificationAndRejectsDuplicateEmail()
    {
        await using var database = await TestDatabase.CreateAsync();
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        var request = CreateRegisterRequest();

        await auth.RegisterAsync(request, CancellationToken.None);
        var user = await database.Context.Users.SingleAsync();
        Assert.False(user.IsActive);
        Assert.Null(user.EmailVerifiedAt);
        Assert.Single(await database.Context.UserGoals.ToListAsync());
        Assert.NotEmpty(sender.Sent);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync(auth, request.Email, request.Password));
        var conflict = await Assert.ThrowsAsync<ConflictException>(() => auth.RegisterAsync(request, CancellationToken.None));
        Assert.Equal("An account with that email already exists.", conflict.Message);
        conflict = await Assert.ThrowsAsync<ConflictException>(() => auth.RegisterAsync(
            request with { Email = "other@example.com" }, CancellationToken.None));
        Assert.Equal("That username is already in use.", conflict.Message);
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
            new CreateFoodLogRequest(food.FoodId, 50m, QuantityUnit.Gram, Jan1.AddDays(1), MealType.Breakfast), CancellationToken.None);
        await foodLogs.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1.AddDays(3), MealType.Dinner), CancellationToken.None);

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
    public async Task CatalogueFoodsAreFoundByBarcodeLoggableAndReadOnly()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var cola = new Food { Name = "Coca-Cola", Barcode = "5449000000996", CaloriesPer100 = 42m,
            CarbohydratesPer100 = 10.6m, CreatedAt = Jan1,
            Servings = [new FoodServing { Unit = ServingUnit.Milliliter, GramsPerUnit = 1m }] };
        database.Context.Foods.Add(cola);
        await database.Context.SaveChangesAsync();
        var foods = new FoodService(database.Context, TimeProvider.System);

        Assert.Empty((await foods.SearchAsync(null, null, false, user.UserId, 30, null, CancellationToken.None)).Items);
        var found = Assert.Single((await foods.SearchAsync(null, "5449000000996", false, user.UserId, 30, null,
            CancellationToken.None)).Items);
        Assert.Null(found.CreatedByUserId);
        Assert.Empty((await foods.SearchAsync(null, "5449000000996", true, user.UserId, 30, null,
            CancellationToken.None)).Items);
        Assert.Equal("Coca-Cola", (await foods.GetAsync(user.UserId, cola.FoodId, CancellationToken.None)).Name);

        var log = await new FoodLogService(database.Context,
            new AchievementService(database.Context, TimeProvider.System), TimeProvider.System,
            NullLogger<FoodLogService>.Instance).CreateAsync(user.UserId,
            new CreateFoodLogRequest(cola.FoodId, 330m, QuantityUnit.Milliliter, Jan1, MealType.Snack), CancellationToken.None);
        Assert.Equal(138.6m, log.CaloriesConsumed);

        // A missing unit may be added; existing servings and the food itself stay read-only.
        Assert.Equal(1m, (await foods.UpsertServingAsync(user.UserId, cola.FoodId,
            new UpsertFoodServingRequest(ServingUnit.Milliliter, 5m), CancellationToken.None)).GramsPerUnit);
        Assert.Equal(100m, (await foods.UpsertServingAsync(user.UserId, cola.FoodId,
            new UpsertFoodServingRequest(ServingUnit.Serving, 100m), CancellationToken.None)).GramsPerUnit);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => foods.UpdateAsync(user.UserId, cola.FoodId,
            new UpdateFoodRequest { Name = "Mine" }, CancellationToken.None));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => foods.DeleteAsync(user.UserId, cola.FoodId,
            CancellationToken.None));
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
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1, MealType.Snack), CancellationToken.None);
        await service.CreateAsync(owner.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1, MealType.Snack), CancellationToken.None);
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
        await service.UpdateAsync(user.UserId, created.WeightLogId,
            new UpdateWeightLogRequest(69m, null), CancellationToken.None);
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
            new LogMealCollectionRequest(Jan1.AddDays(1), MealType.Dinner), CancellationToken.None);
        Assert.Equal(2, logs.Count);
        Assert.All(logs, log => Assert.Equal(MealType.Dinner, log.MealType));
        Assert.All(await database.Context.FoodLogs.ToListAsync(), log => Assert.Equal(MealType.Dinner, log.MealType));
    }

    [Fact]
    public async Task RefreshReturnsTodaysTokenUnchangedAndRotatesOlderOnes()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserWithPasswordAsync(database.Context);
        // Issue "yesterday" so nbf stays before the real clock JwtSecurityTokenHandler validates against.
        var clock = new MutableTimeProvider(DateTimeOffset.UtcNow.AddDays(-1));
        var auth = CreateAuth(database.Context, new CapturingSender(), clock);
        var yesterday = await LoginAsync(auth, user.Email, Password);
        clock.Now = DateTimeOffset.UtcNow;

        var rotated = await auth.RefreshAsync(new RefreshRequest { RefreshToken = yesterday.RefreshToken },
            CancellationToken.None);
        Assert.NotEqual(yesterday.RefreshToken, rotated.RefreshToken);
        await Assert.ThrowsAsync<UnauthorizedException>(() => auth.RefreshAsync(
            new RefreshRequest { RefreshToken = yesterday.RefreshToken }, CancellationToken.None));

        var rows = await database.Context.RefreshTokens.CountAsync();
        var same = await auth.RefreshAsync(new RefreshRequest { RefreshToken = rotated.RefreshToken },
            CancellationToken.None);
        Assert.Equal(rotated.RefreshToken, same.RefreshToken);
        Assert.NotEqual(rotated.AccessToken, same.AccessToken);
        Assert.InRange(same.RefreshTokenExpiresAt, rotated.RefreshTokenExpiresAt.AddSeconds(-1),
            rotated.RefreshTokenExpiresAt);
        Assert.Equal(rows, await database.Context.RefreshTokens.CountAsync());
    }

    [Fact]
    public async Task PasswordResetLinkIsCheckedWithoutUseThenConsumedAndRevokesSessions()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserWithPasswordAsync(database.Context);
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        var login = await LoginAsync(auth, user.Email, Password);

        await auth.ForgotPasswordAsync(new ForgotPasswordRequest(" owner "), CancellationToken.None);
        var mail = sender.Sent.Single();
        Assert.Equal(user.Email, mail.Email);
        Assert.Equal("Nulstil din adgangskode · Reset your password – Nutrify", mail.Subject);
        Assert.Contains("http://localhost:5210/api/v1/auth/password/reset?token=", mail.Body);
        var resetToken = TokenFrom(mail.Body);
        Assert.True(await auth.IsPasswordResetTokenActiveAsync(resetToken, CancellationToken.None));
        Assert.True(await auth.IsPasswordResetTokenActiveAsync(resetToken, CancellationToken.None));

        await auth.ResetPasswordAsync(new ResetPasswordRequest(resetToken,
            "AnotherLongPassword1!", "AnotherLongPassword1!"), CancellationToken.None);
        Assert.False(await auth.IsPasswordResetTokenActiveAsync(resetToken, CancellationToken.None));
        await Assert.ThrowsAsync<BusinessValidationException>(() => auth.ResetPasswordAsync(
            new ResetPasswordRequest(resetToken, "ThirdLongPassword1!", "ThirdLongPassword1!"), CancellationToken.None));
        await Assert.ThrowsAsync<UnauthorizedException>(() => auth.RefreshAsync(
            new RefreshRequest { RefreshToken = login.RefreshToken }, CancellationToken.None));
        await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, user.Email, Password));
        await LoginAsync(auth, user.Username, "AnotherLongPassword1!");
    }

    [Fact]
    public async Task ForgotPasswordIsSilentForUnknownAndUnverifiedAccounts()
    {
        await using var database = await TestDatabase.CreateAsync();
        await SeedUserWithPasswordAsync(database.Context, "pending", verified: false);
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        await auth.ForgotPasswordAsync(new ForgotPasswordRequest("pending"), CancellationToken.None);
        await auth.ForgotPasswordAsync(new ForgotPasswordRequest("nobody@example.com"), CancellationToken.None);
        Assert.Empty(sender.Sent);
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
            new CapturingSender(), storage, AppSettings, NullLogger<UserAccountService>.Instance);
        await accounts.SoftDeleteAsync(user.UserId, CancellationToken.None);
        Assert.Contains(key, storage.Deleted);
        Assert.Empty(database.Context.UserProfiles.Where(profile => profile.UserId == user.UserId));
    }

    [Fact]
    public async Task LoginAcceptsEmailOrUsernameAndSeparatesUnverifiedFromWrongCredentials()
    {
        await using var database = await TestDatabase.CreateAsync();
        var owner = await SeedUserWithPasswordAsync(database.Context);
        await SeedUserWithPasswordAsync(database.Context, "pending", verified: false);
        var auth = CreateAuth(database.Context, new CapturingSender());

        Assert.Equal(owner.UserId, (await LoginAsync(auth, " OWNER@example.com ", Password)).User.UserId);
        Assert.Equal(owner.UserId, (await LoginAsync(auth, "owner", Password)).User.UserId);
        Assert.Equal(owner.UserId, (await LoginAsync(auth, " Owner ", Password)).User.UserId);
        // The app polls with the right password while it waits for verification, so 403 must never lock out.
        for (var i = 0; i < 7; i++)
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync(auth, i % 2 == 0 ? "pending" : "pending@example.com", Password));
        var wrong = await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, "owner@example.com", "WrongPassword1!"));
        foreach (var attempt in new Func<Task>[]
        {
            () => LoginAsync(auth, "OWNER", "WrongPassword1!"),
            () => LoginAsync(auth, "pending", "WrongPassword1!"),
            () => LoginAsync(auth, "pending@example.com", "WrongPassword1!"),
            () => LoginAsync(auth, "nobody@example.com", Password),
            () => LoginAsync(auth, "nobody", Password)
        })
        {
            var exception = await Assert.ThrowsAsync<UnauthorizedException>(attempt);
            Assert.Equal(wrong.Message, exception.Message);
        }
    }

    [Fact]
    public async Task SixthLoginAttemptIsLockedOutEvenWithTheRightPassword()
    {
        await using var database = await TestDatabase.CreateAsync();
        await SeedUserWithPasswordAsync(database.Context);
        var auth = CreateAuth(database.Context, new CapturingSender());
        for (var i = 0; i < 5; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, i % 2 == 0 ? "owner" : "owner@example.com", "WrongPassword1!"));
        await Assert.ThrowsAsync<TooManyRequestsException>(() => LoginAsync(auth, "owner", Password));
        for (var i = 0; i < 5; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, "nobody", Password));
        await Assert.ThrowsAsync<TooManyRequestsException>(() => LoginAsync(auth, "NOBODY", Password));
    }

    [Fact]
    public async Task UnknownNumericIdentifierDoesNotLockTheAccountWithThatId()
    {
        await using var database = await TestDatabase.CreateAsync();
        var owner = await SeedUserWithPasswordAsync(database.Context);
        var auth = CreateAuth(database.Context, new CapturingSender());
        var id = owner.UserId.ToString();
        for (var i = 0; i < 5; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, id, Password));
        await Assert.ThrowsAsync<TooManyRequestsException>(() => LoginAsync(auth, id, Password));
        Assert.Equal(owner.UserId, (await LoginAsync(auth, "owner", Password)).User.UserId);
    }

    [Fact]
    public async Task SuccessfulLoginResetsTheFailureCounter()
    {
        await using var database = await TestDatabase.CreateAsync();
        await SeedUserWithPasswordAsync(database.Context);
        var auth = CreateAuth(database.Context, new CapturingSender());
        for (var i = 0; i < 4; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, "owner", "WrongPassword1!"));
        await LoginAsync(auth, "owner", Password);
        for (var i = 0; i < 5; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, "owner", "WrongPassword1!"));
    }

    [Fact]
    public async Task PasswordResetLiftsTheLoginLockout()
    {
        await using var database = await TestDatabase.CreateAsync();
        await SeedUserWithPasswordAsync(database.Context);
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        for (var i = 0; i < 5; i++)
            await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(auth, "owner", "WrongPassword1!"));
        await auth.ForgotPasswordAsync(new ForgotPasswordRequest("owner"), CancellationToken.None);
        await auth.ResetPasswordAsync(new ResetPasswordRequest(TokenFrom(sender.Sent.Single().Body),
            "AnotherLongPassword1!", "AnotherLongPassword1!"), CancellationToken.None);
        await LoginAsync(auth, "owner", "AnotherLongPassword1!");
    }

    [Theory]
    [InlineData("a@b")]
    [InlineData("has space")]
    [InlineData(" person")]
    public void UsernameMustBeLettersNumbersHyphensOrUnderscores(string username)
    {
        var results = new List<ValidationResult>();
        var request = CreateRegisterRequest() with { Username = username };
        Assert.False(Validator.TryValidateObject(request, new ValidationContext(request), results, true));
        Assert.Contains(results, result => result.MemberNames.Contains(nameof(RegisterRequest.Username)));
        var valid = CreateRegisterRequest();
        Assert.True(Validator.TryValidateObject(valid, new ValidationContext(valid), [], true));
    }

    [Fact]
    public async Task VerificationMailLinksToTheGetPageAndResendInvalidatesOlderLinks()
    {
        await using var database = await TestDatabase.CreateAsync();
        var sender = new CapturingSender();
        var clock = new MutableTimeProvider(DateTimeOffset.UtcNow);
        var auth = CreateAuth(database.Context, sender, clock);
        await auth.RegisterAsync(CreateRegisterRequest(), CancellationToken.None);
        var mail = sender.Sent.Single();
        Assert.Equal("Bekræft din e-mail · Confirm your e-mail – Nutrify", mail.Subject);
        Assert.Contains("bekræfte din e-mail til Nutrify. Linket gælder i 24 timer.", mail.Body);
        Assert.Contains("http://localhost:5210/api/v1/auth/email/verify?token=", mail.Body);
        var first = TokenFrom(mail.Body);

        await auth.ResendVerificationAsync(new ResendVerificationRequest("person"), CancellationToken.None);
        Assert.Single(sender.Sent); // at most one mail per minute
        clock.Now = clock.Now.AddMinutes(1).AddSeconds(1);
        await auth.ResendVerificationAsync(new ResendVerificationRequest("PERSON"), CancellationToken.None);
        var second = TokenFrom(sender.Sent.Last().Body);
        Assert.Equal(2, sender.Sent.Count);
        database.Context.ChangeTracker.Clear(); // a new request: the resend invalidated the first token via ExecuteUpdate
        var controller = CreateAuthController(auth);
        Assert.Equal(StatusCodes.Status400BadRequest, (await controller.VerifyEmailLink(first, CancellationToken.None)).StatusCode);
        var page = await controller.VerifyEmailLink(second, CancellationToken.None);
        Assert.Equal(StatusCodes.Status200OK, page.StatusCode);
        Assert.Equal("text/html; charset=utf-8", page.ContentType);
        Assert.Contains("Din e-mail er bekræftet.", page.Content);
        Assert.Equal("no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.StartsWith("default-src 'none'", controller.Response.Headers.ContentSecurityPolicy.ToString());
        Assert.True((await database.Context.Users.SingleAsync()).IsActive);
        Assert.Equal(StatusCodes.Status400BadRequest, (await controller.VerifyEmailLink(second, CancellationToken.None)).StatusCode);
        Assert.Equal(StatusCodes.Status400BadRequest, (await controller.VerifyEmailLink(null, CancellationToken.None)).StatusCode);
        await auth.ResendVerificationAsync(new ResendVerificationRequest("person@example.com"), CancellationToken.None);
        Assert.Equal(2, sender.Sent.Count);
        await LoginAsync(auth, "person", Password);
    }

    [Fact]
    public async Task ResetPageValidatesTheFormAndEchoesTheTokenEncoded()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserWithPasswordAsync(database.Context);
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        await auth.ForgotPasswordAsync(new ForgotPasswordRequest(user.Email), CancellationToken.None);
        var token = TokenFrom(sender.Sent.Single().Body);
        var controller = CreateAuthController(auth);

        var form = await controller.ResetPasswordForm(token, CancellationToken.None);
        Assert.Equal(StatusCodes.Status200OK, form.StatusCode);
        Assert.Contains($"name=\"token\" value=\"{token}\"", form.Content);
        Assert.Equal(StatusCodes.Status400BadRequest,
            (await controller.ResetPasswordForm("<x>", CancellationToken.None)).StatusCode);
        var mismatch = await controller.ResetPassword(token, "AnotherLongPassword1!", "Different1!", CancellationToken.None);
        Assert.Equal(StatusCodes.Status400BadRequest, mismatch.StatusCode);
        Assert.Contains("Adgangskoderne er ikke ens", mismatch.Content);
        var tooShort = await controller.ResetPassword("\"><script>", "short", "short", CancellationToken.None);
        Assert.Contains("Adgangskoden skal være 10–200 tegn", tooShort.Content);
        Assert.Contains("value=\"&quot;&gt;&lt;script&gt;\"", tooShort.Content);
        Assert.Contains("Ugyldigt link", (await controller.ResetPassword(null, null, null, CancellationToken.None)).Content);
        var done = await controller.ResetPassword(token, "AnotherLongPassword1!", "AnotherLongPassword1!", CancellationToken.None);
        Assert.Equal(StatusCodes.Status200OK, done.StatusCode);
        Assert.Contains("Adgangskode skiftet", done.Content);
        var reused = await controller.ResetPassword(token, "ThirdLongPassword1!", "ThirdLongPassword1!", CancellationToken.None);
        Assert.Equal(StatusCodes.Status400BadRequest, reused.StatusCode);
        Assert.Contains("Ugyldigt link", reused.Content);
    }

    [Fact]
    public async Task EmailChangeKeepsTheAccountActiveUntilTheNewAddressIsVerified()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        database.Context.RefreshTokens.Add(new RefreshToken { TokenId = "session", UserId = user.UserId,
            State = TokenState.Active });
        await database.Context.SaveChangesAsync();
        var sender = new CapturingSender();
        var accounts = new UserAccountService(database.Context, TimeProvider.System, sender,
            new FakeImageStorage(), AppSettings, NullLogger<UserAccountService>.Instance);
        var auth = CreateAuth(database.Context, sender);

        var dto = await accounts.UpdateAsync(user.UserId, new UpdateAccountRequest(" New@Example.com ", null),
            CancellationToken.None);
        Assert.Equal("owner@example.com", dto.Email);
        Assert.True(dto.IsActive);
        Assert.Equal("new@example.com", sender.Sent.Single().Email);
        Assert.Equal(TokenState.Active, (await database.Context.RefreshTokens.SingleAsync()).State);
        await database.Context.Entry(user).ReloadAsync();
        Assert.Equal("owner@example.com", user.Email);
        Assert.True(user.IsActive);

        await auth.VerifyEmailAsync(new VerifyEmailRequest(TokenFrom(sender.Sent.Single().Body)), CancellationToken.None);
        await database.Context.Entry(user).ReloadAsync();
        Assert.Equal("new@example.com", user.Email);
        Assert.True(user.IsActive);
    }

    [Fact]
    public async Task EmailChangeFailsAtVerifyWhenTheAddressWasTakenMeanwhile()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var sender = new CapturingSender();
        var accounts = new UserAccountService(database.Context, TimeProvider.System, sender,
            new FakeImageStorage(), AppSettings, NullLogger<UserAccountService>.Instance);
        await accounts.UpdateAsync(user.UserId, new UpdateAccountRequest("taken@example.com", null), CancellationToken.None);
        await SeedUserAsync(database.Context, "taken");

        await Assert.ThrowsAsync<BusinessValidationException>(() => CreateAuth(database.Context, sender)
            .VerifyEmailAsync(new VerifyEmailRequest(TokenFrom(sender.Sent.Single().Body)), CancellationToken.None));
        await database.Context.Entry(user).ReloadAsync();
        Assert.Equal("owner@example.com", user.Email);
    }

    [Fact]
    public async Task FoodLogRequiresAMealTypeAndReturnsIt()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var food = new Food { Name = "Soup", CreatedByUserId = user.UserId, CaloriesPer100 = 50m, CreatedAt = Jan1 };
        database.Context.Foods.Add(food);
        await database.Context.SaveChangesAsync();
        var service = new FoodLogService(database.Context,
            new AchievementService(database.Context, TimeProvider.System), TimeProvider.System,
            NullLogger<FoodLogService>.Instance);
        await Assert.ThrowsAsync<BusinessValidationException>(() => service.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1, 0), CancellationToken.None));
        var created = await service.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1, MealType.Lunch), CancellationToken.None);
        Assert.Equal(MealType.Lunch, created.MealType);
        var updated = await service.UpdateAsync(user.UserId, created.FoodLogId,
            new UpdateFoodLogRequest(null, 200m, null, null), CancellationToken.None);
        Assert.Equal(MealType.Lunch, updated.MealType);
        Assert.Equal(MealType.Lunch, (await service.GetAsync(user.UserId, created.FoodLogId, CancellationToken.None)).MealType);
    }

    [Fact]
    public void NutritionThatWouldOverflowItsColumnIsAValidationError()
    {
        var food = new Food { Name = "Dense", CaloriesPer100 = 50_000m };
        Assert.Equal(99_999.99m, FoodNutritionCalculator.Calculate(food, 199.99998m, QuantityUnit.Gram).Calories);
        Assert.Throws<BusinessValidationException>(() => FoodNutritionCalculator.Calculate(food, 200m, QuantityUnit.Gram));
        Assert.Throws<BusinessValidationException>(() => FoodNutritionCalculator.Calculate(food, 10_000_000m, QuantityUnit.Gram));
    }

    [Fact]
    public async Task HistoryEventsCarryTheirPayload()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var stranger = await SeedUserAsync(database.Context, "stranger");
        var food = new Food { Name = "Apple", CreatedByUserId = user.UserId, CaloriesPer100 = 52m, CreatedAt = Jan1 };
        var goal = new UserGoal { UserId = user.UserId, GoalType = GoalType.MaintainWeight, TargetWeight = 70m,
            TargetDailyCalories = 2000m, CreatedAt = Jan1.AddDays(1) };
        var weight = new WeightLog { UserId = user.UserId, Weight = 69.5m, RecordedAt = Jan1.AddDays(2),
            RecordedDate = new DateOnly(2026, 1, 3) };
        database.Context.AddRange(food, goal, weight, new WeightLog { UserId = stranger.UserId, Weight = 80m,
            RecordedAt = Jan1.AddDays(2), RecordedDate = new DateOnly(2026, 1, 3) });
        await database.Context.SaveChangesAsync();
        var logs = new FoodLogService(database.Context, new AchievementService(database.Context, TimeProvider.System),
            TimeProvider.System, NullLogger<FoodLogService>.Instance);
        var kept = await logs.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1.AddDays(3), MealType.Snack), CancellationToken.None);
        var removed = await logs.CreateAsync(user.UserId,
            new CreateFoodLogRequest(food.FoodId, 100m, QuantityUnit.Gram, Jan1.AddDays(4), MealType.Snack), CancellationToken.None);
        await logs.DeleteAsync(user.UserId, removed.FoodLogId, CancellationToken.None);

        var items = (await new HistoryService(database.Context).GetAsync(user.UserId, null, null, null, 50, null,
            CancellationToken.None)).Items;
        Assert.Equal(5, items.Count);
        Assert.All(items.Where(item => item.Type is HistoryEventType.AccountCreated or HistoryEventType.AchievementCompleted),
            item => Assert.True(item.FoodLog is null && item.WeightLog is null && item.Goal is null));
        var foodEvent = items.Single(item => item.Type == HistoryEventType.FoodLogged);
        Assert.Equal(kept.FoodLogId, foodEvent.FoodLog?.FoodLogId);
        Assert.Equal("Apple", foodEvent.FoodLog?.FoodName);
        Assert.True(foodEvent.WeightLog is null && foodEvent.Goal is null);
        Assert.Equal(69.5m, items.Single(item => item.Type == HistoryEventType.WeightRecorded).WeightLog?.Weight);
        Assert.Equal(goal.UserGoalId, items.Single(item => item.Type == HistoryEventType.GoalUpdated).Goal?.UserGoalId);
    }

    [Fact]
    public async Task ExportDownloadTokenRoundTripsAndRejectsGarbage()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context);
        var service = new UserDataExportService(database.Context,
            new AchievementService(database.Context, TimeProvider.System), new FakeImageStorage(),
            new EphemeralDataProtectionProvider());
        var token = service.CreateDownloadToken(user.UserId);
        Assert.Equal(user.Email, (await service.GetByDownloadTokenAsync(token, CancellationToken.None)).Account.Email);
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetByDownloadTokenAsync("garbage", CancellationToken.None));
        await Assert.ThrowsAsync<NotFoundException>(() => service.GetByDownloadTokenAsync(null, CancellationToken.None));
    }

    private static AuthController CreateAuthController(AuthService auth) => new(auth)
    {
        ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
    };

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

    private static AuthService CreateAuth(FitnessAppDbContext context, CapturingSender sender,
        TimeProvider? clock = null, IMemoryCache? cache = null)
    {
        clock ??= TimeProvider.System;
        var jwt = new JwtTokenService(Microsoft.Extensions.Options.Options.Create(new JwtOptions
        {
            Issuer = "test", Audience = "test", SigningKey = new string('x', 64), AccessTokenMinutes = 15
        }), Microsoft.Extensions.Options.Options.Create(new RefreshTokenOptions { LifetimeDays = 30 }), clock);
        return new AuthService(context, jwt, new PasswordHasher<User>(), sender,
            new ConfigurationBuilder().Build(), clock, cache ?? new MemoryCache(new MemoryCacheOptions()),
            AppSettings, NullLogger<AuthService>.Instance);
    }

    private static Task<AuthResponse> LoginAsync(AuthService auth, string identifier, string password)
        => auth.LoginAsync(new LoginRequest { EmailOrUsername = identifier, Password = password },
            CancellationToken.None);

    private static string TokenFrom(string body) => Regex.Match(body, "token=([0-9A-F]{64})").Groups[1].Value;

    private static RegisterRequest CreateRegisterRequest() => new()
    {
        Email = "person@example.com", Username = "person", Password = Password,
        PasswordConfirmation = Password, BirthDate = new DateOnly(2000, 1, 1),
        Gender = Gender.Female, StartingWeight = 70m, Height = 170m, DailySteps = 5000,
        TrainingDaysPerWeek = 3, WorkoutDurationMinutes = 45,
        TrainingIntensity = TrainingIntensity.Moderate, GoalType = GoalType.MaintainWeight,
        AcceptedTerms = true, TimeZoneId = "UTC"
    };

    private static async Task<User> SeedUserWithPasswordAsync(FitnessAppDbContext context, string name = "owner",
        bool verified = true)
    {
        var user = await SeedUserAsync(context, name);
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Password);
        if (!verified)
        {
            user.EmailVerifiedAt = null;
            user.IsActive = false;
        }
        await context.SaveChangesAsync();
        return user;
    }

    private sealed class MutableTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private sealed class CapturingSender : IAccountMessageSender
    {
        public List<(string Email, string Subject, string Body)> Sent { get; } = [];
        public Task SendAsync(string email, AccountEmail mail, CancellationToken cancellationToken)
        {
            Sent.Add((email, mail.Subject, mail.Text));
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
            modelBuilder.Entity<User>().Property(user => user.NormalizedUsername)
                .HasComputedColumnSql("lower(\"Username\")", stored: true);
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
