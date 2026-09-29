using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Profiles;

public sealed class UserProfileService(
    FitnessAppDbContext context,
    IUserGoalService goalService,
    TimeProvider timeProvider,
    IProfileImageStorage imageStorage) : IUserProfileService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IUserGoalService _goalService = goalService;
    private readonly TimeProvider _timeProvider = timeProvider;
    private readonly IProfileImageStorage _imageStorage = imageStorage;

    public async Task<UserProfileDto?> GetAsync(int userId, CancellationToken cancellationToken)
    {
        var profile = await _context.UserProfiles
            .AsNoTracking()
            .SingleOrDefaultAsync(profile => profile.UserId == userId, cancellationToken);

        return profile is null ? null : ToDto(profile);
    }

    public async Task<UserProfileDto> UpsertAsync(
        int userId,
        UpsertUserProfileRequest request,
        CancellationToken cancellationToken)
    {
        var userExists = await _context.Users
            .AnyAsync(user => user.UserId == userId && user.DeletedAt == null, cancellationToken);
        if (!userExists)
        {
            throw new NotFoundException("User not found.");
        }

        var profile = await _context.UserProfiles
            .SingleOrDefaultAsync(profile => profile.UserId == userId, cancellationToken);

        if (profile is null)
        {
            var startingWeight = await _context.WeightLogs.Where(log => log.UserId == userId)
                .OrderBy(log => log.RecordedAt).Select(log => (decimal?)log.Weight)
                .FirstOrDefaultAsync(cancellationToken);
            profile = new UserProfile { UserId = userId, StartingWeight = startingWeight ?? 0m };
            _context.UserProfiles.Add(profile);
        }

        var changed = profile.BirthDate != request.BirthDate
            || profile.Gender != request.Gender
            || profile.Height != request.Height
            || profile.DailySteps != request.DailySteps
            || profile.TrainingDaysPerWeek != request.TrainingDaysPerWeek
            || profile.WorkoutDurationMinutes != request.WorkoutDurationMinutes
            || profile.TrainingIntensity != request.TrainingIntensity;

        profile.BirthDate = request.BirthDate;
        profile.Gender = request.Gender;
        profile.Height = request.Height;
        profile.DailySteps = request.DailySteps;
        profile.TrainingDaysPerWeek = request.TrainingDaysPerWeek;
        profile.WorkoutDurationMinutes = request.WorkoutDurationMinutes;
        profile.TrainingIntensity = request.TrainingIntensity;
        if (request.TimeZoneId is not null) profile.TimeZoneId = request.TimeZoneId;

        ProfileValidation.Validate(profile, _timeProvider.GetUtcNow().UtcDateTime);

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        if (changed && await _context.UserGoals.AnyAsync(goal => goal.UserId == userId, cancellationToken))
            await _goalService.RecalculateAsync(userId, true, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToDto(profile);
    }

    public async Task<UserProfileDto> PatchAsync(int userId, PatchUserProfileRequest request, CancellationToken cancellationToken)
    {
        var current = await GetAsync(userId, cancellationToken)
            ?? throw new NotFoundException("Profile not found.");
        return await UpsertAsync(userId, new UpsertUserProfileRequest(
            request.BirthDate ?? current.BirthDate,
            request.Gender ?? current.Gender,
            request.Height ?? current.Height,
            request.DailySteps ?? current.DailySteps,
            request.TrainingDaysPerWeek ?? current.TrainingDaysPerWeek,
            request.WorkoutDurationMinutes ?? current.WorkoutDurationMinutes,
            request.TrainingIntensity ?? current.TrainingIntensity,
            request.TimeZoneId ?? current.TimeZoneId), cancellationToken);
    }

    public async Task<UserProfileDto> UpdateActivityAsync(int userId, UpdateActivityRequest request,
        CancellationToken cancellationToken)
    {
        if (request.FromHealthIntegration && !await _context.UserConsents.AsNoTracking().AnyAsync(
            consent => consent.UserId == userId && consent.ConsentType == ConsentType.StepsIntegration
                && consent.WithdrawnAt == null, cancellationToken))
            throw new UnauthorizedAccessException("Steps integration consent is required.");
        return await PatchAsync(userId, new PatchUserProfileRequest(null, null, null,
            request.DailySteps, null, null, null, null), cancellationToken);
    }

    private UserProfileDto ToDto(UserProfile profile)
    {
        return new UserProfileDto(
            profile.UserProfileId,
            profile.UserId,
            profile.BirthDate,
            profile.Gender,
            profile.Height,
            profile.StartingWeight,
            profile.DailySteps,
            profile.TrainingDaysPerWeek,
            profile.WorkoutDurationMinutes,
            profile.TrainingIntensity,
            profile.TimeZoneId,
            profile.ProfileImagePath is null ? null : _imageStorage.GetUrl(profile.ProfileImagePath));
    }
}
