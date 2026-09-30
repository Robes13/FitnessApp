using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Utilities;
using FitnessApp.Api.Services.Profiles;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Auth;

public sealed class UserAccountService(
    FitnessAppDbContext context,
    TimeProvider timeProvider,
    IAccountMessageSender messageSender,
    IProfileImageStorage imageStorage,
    ILogger<UserAccountService> logger) : IUserAccountService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly TimeProvider _timeProvider = timeProvider;
    private readonly IAccountMessageSender _messageSender = messageSender;
    private readonly IProfileImageStorage _imageStorage = imageStorage;
    private readonly ILogger<UserAccountService> _logger = logger;

    public async Task<UserDto> GetAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .AsNoTracking()
            .SingleOrDefaultAsync(user => user.UserId == userId && user.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        return new UserDto(
            user.UserId, user.Email, user.Username, user.IsActive, user.EmailVerifiedAt, user.CreatedAt);
    }

    public async Task<UserDto> UpdateAsync(int userId, UpdateAccountRequest request, CancellationToken cancellationToken)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await _context.Users.Where(candidate => candidate.UserId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.Email, candidate => candidate.Email), cancellationToken);
        var user = await _context.Users.SingleOrDefaultAsync(candidate => candidate.UserId == userId
            && candidate.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("User not found.");
        var emailChanged = request.Email is not null
            && !string.Equals(user.Email, request.Email.Trim(), StringComparison.OrdinalIgnoreCase);
        if (request.Username is not null)
        {
            var username = UsernameRules.Validate(request.Username);
            var normalizedUsername = UsernameRules.Normalize(username);
            if (await _context.Users.AnyAsync(candidate => candidate.NormalizedUsername == normalizedUsername
                && candidate.UserId != userId, cancellationToken))
                throw new ConflictException("That username is already in use.");
            user.Username = username;
        }

        string? verificationToken = null;
        if (emailChanged)
        {
            var email = request.Email!.Trim().ToLowerInvariant();
            if (await _context.Users.AnyAsync(candidate => candidate.Email == email
                && candidate.UserId != userId, cancellationToken))
                throw new ConflictException("An account with that email already exists.");
            user.Email = email;
            user.EmailVerifiedAt = null;
            user.IsActive = false;
            verificationToken = SecretToken.Create();
            var now = _timeProvider.GetUtcNow().UtcDateTime;
            await _context.EmailVerificationTokens.Where(token => token.UserId == userId && token.UsedAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.UsedAt, now), cancellationToken);
            _context.EmailVerificationTokens.Add(new Domain.Entities.EmailVerificationToken
            {
                UserId = userId,
                Email = email,
                TokenHash = SecretToken.Hash(verificationToken),
                CreatedAt = now,
                ExpiresAt = now.AddHours(24)
            });
            await _context.RefreshTokens.Where(token => token.UserId == userId && token.State == TokenState.Active)
                .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.State, TokenState.Revoked), cancellationToken);
        }

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        if (verificationToken is not null)
            await _messageSender.SendVerificationAsync(user.Email, verificationToken, cancellationToken);
        return new UserDto(user.UserId, user.Email, user.Username, user.IsActive,
            user.EmailVerifiedAt, user.CreatedAt);
    }

    public async Task SoftDeleteAsync(int userId, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .SingleOrDefaultAsync(user => user.UserId == userId && user.DeletedAt == null, cancellationToken)
            ?? throw new NotFoundException("User not found.");

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        var imageKey = await _context.UserProfiles.Where(profile => profile.UserId == userId)
            .Select(profile => profile.ProfileImagePath).SingleOrDefaultAsync(cancellationToken);
        // Keep a non-identifying account row for the existing FOOD.CreatedByUserId FK.
        // Legacy cross-user food references retain nutrition values but lose creator content.
        await _context.FoodLogs.Where(log => log.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.MealCollections.Where(collection => collection.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _context.Foods.Where(food => food.CreatedByUserId == userId
            && !food.FoodLogs.Any() && !food.MealItems.Any()).ExecuteDeleteAsync(cancellationToken);
        await _context.Foods.Where(food => food.CreatedByUserId == userId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(food => food.Name, "Deleted user food")
                .SetProperty(food => food.Barcode, (string?)null), cancellationToken);
        await _context.UserGoals.Where(goal => goal.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.WeightLogs.Where(log => log.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.Reminders.Where(reminder => reminder.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.UserSettings.Where(setting => setting.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.UserAchievements.Where(achievement => achievement.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _context.UserProfiles.Where(profile => profile.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.UserConsents.Where(consent => consent.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.UserDevices.Where(device => device.UserId == userId).ExecuteDeleteAsync(cancellationToken);
        await _context.EmailVerificationTokens.Where(token => token.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _context.PasswordResetTokens.Where(token => token.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _context.RefreshTokens.Where(token => token.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        await _context.LogEntries.Where(entry => entry.UserId == userId).ExecuteDeleteAsync(cancellationToken);

        var anonymousId = Guid.NewGuid().ToString("N");
        user.Email = $"deleted-{anonymousId}@invalid.local";
        user.Username = $"deleted-{anonymousId}";
        user.PasswordHash = Guid.NewGuid().ToString("N");
        user.EmailVerifiedAt = null;
        user.DeletedAt = _timeProvider.GetUtcNow().UtcDateTime;
        user.IsActive = false;
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        if (imageKey is not null)
        {
            try { await _imageStorage.DeleteAsync(imageKey, CancellationToken.None); }
            catch (Exception exception) { _logger.LogWarning("Account profile image blob cleanup failed for user {UserId}: {ErrorType}", userId, exception.GetType().Name); }
        }
        _logger.LogInformation("User {UserId} was anonymized", userId);
    }
}
