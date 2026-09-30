using System.Globalization;
using System.Security.Cryptography;
using FitnessApp.Api.Data;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.DTOs.Consent;
using FitnessApp.Api.DTOs.Export;
using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.DTOs.Reminders;
using FitnessApp.Api.DTOs.Settings;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Achievements;
using FitnessApp.Api.Services.FoodLogs;
using FitnessApp.Api.Services.Foods;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Services.Meals;
using FitnessApp.Api.Services.Profiles;
using FitnessApp.Api.Services.Weights;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Export;

public sealed class UserDataExportService(
    FitnessAppDbContext context,
    IAchievementService achievementService,
    IProfileImageStorage imageStorage,
    IDataProtectionProvider dataProtectionProvider) : IUserDataExportService
{
    private const string InvalidLink = "Export link is invalid or expired.";
    private static readonly TimeSpan DownloadTokenLifetime = TimeSpan.FromMinutes(5);
    private readonly FitnessAppDbContext _context = context;
    private readonly IAchievementService _achievementService = achievementService;
    private readonly IProfileImageStorage _imageStorage = imageStorage;
    private readonly ITimeLimitedDataProtector _protector = dataProtectionProvider
        .CreateProtector("FitnessApp.DataExport.v1").ToTimeLimitedDataProtector();

    // ponytail: stateless 5-minute token, reusable within its lifetime; add a single-use table only if needed
    public string CreateDownloadToken(int userId)
        => _protector.Protect(userId.ToString(CultureInfo.InvariantCulture), DownloadTokenLifetime);

    public Task<UserDataExportDto> GetByDownloadTokenAsync(string? token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token)) throw new NotFoundException(InvalidLink);
        int userId;
        try
        {
            userId = int.Parse(_protector.Unprotect(token), CultureInfo.InvariantCulture);
        }
        catch (Exception exception) when (exception is CryptographicException or FormatException)
        {
            throw new NotFoundException(InvalidLink);
        }

        return GetAsync(userId, cancellationToken);
    }

    public async Task<UserDataExportDto> GetAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _context.Users.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId && candidate.DeletedAt == null,
                cancellationToken) ?? throw new NotFoundException("User not found.");
        var profile = await _context.UserProfiles.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.UserId == userId, cancellationToken);
        var goals = await _context.UserGoals.AsNoTracking().Where(goal => goal.UserId == userId)
            .OrderBy(goal => goal.CreatedAt).ThenBy(goal => goal.UserGoalId)
            .ToListAsync(cancellationToken);
        var foods = await _context.Foods.AsNoTracking().Where(food => food.CreatedByUserId == userId)
            .Include(food => food.Servings).ToListAsync(cancellationToken);
        var foodLogs = await _context.FoodLogs.AsNoTracking().Where(log => log.UserId == userId)
            .Include(log => log.Food).OrderBy(log => log.ConsumedAt)
            .ToListAsync(cancellationToken);
        var weightLogs = await _context.WeightLogs.AsNoTracking().Where(log => log.UserId == userId)
            .OrderBy(log => log.RecordedAt).ToListAsync(cancellationToken);
        var collections = await _context.MealCollections.AsNoTracking()
            .Where(collection => collection.UserId == userId)
            .Include(collection => collection.Items).ThenInclude(item => item.Food)
                .ThenInclude(food => food.Servings)
            .AsSplitQuery().ToListAsync(cancellationToken);
        var reminders = await _context.Reminders.AsNoTracking().Where(item => item.UserId == userId)
            .Select(item => new ReminderDto(item.ReminderId, item.ReminderType,
                item.ReminderTime, item.IsEnabled)).ToListAsync(cancellationToken);
        var settings = await _context.UserSettings.AsNoTracking().Where(item => item.UserId == userId)
            .Select(item => new UserSettingDto(item.SettingKey, item.SettingValue, item.UpdatedAt))
            .ToListAsync(cancellationToken);
        var consents = await _context.UserConsents.AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.GrantedAt)
            .Select(item => new UserConsentDto(item.UserConsentId, item.ConsentType,
                item.DocumentVersion, item.GrantedAt, item.WithdrawnAt))
            .ToListAsync(cancellationToken);

        return new UserDataExportDto(
            new UserDto(user.UserId, user.Email, user.Username, user.IsActive,
                user.EmailVerifiedAt, user.CreatedAt),
            profile is null ? null : new UserProfileDto(profile.UserProfileId, profile.UserId,
                profile.BirthDate, profile.Gender, profile.Height, profile.StartingWeight,
                profile.DailySteps, profile.TrainingDaysPerWeek, profile.WorkoutDurationMinutes,
                profile.TrainingIntensity, profile.TimeZoneId,
                profile.ProfileImagePath is null ? null : _imageStorage.GetUrl(profile.ProfileImagePath)),
            goals.Select(UserGoalService.ToDto).ToList(),
            foods.Select(FoodService.ToDto).ToList(),
            foodLogs.Select(FoodLogService.ToDto).ToList(),
            weightLogs.Select(WeightLogService.ToDto).ToList(),
            collections.Select(MealCollectionService.ToDto).ToList(),
            reminders, settings,
            await _achievementService.GetAllAsync(userId, cancellationToken),
            consents);
    }
}
