using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Utilities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Auth;

public sealed class AuthService(
    FitnessAppDbContext context,
    IJwtTokenService jwtTokenService,
    IPasswordHasher<User> passwordHasher,
    IAccountMessageSender messageSender,
    IConfiguration configuration,
    TimeProvider timeProvider,
    ILogger<AuthService> logger) : IAuthService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IJwtTokenService _jwtTokenService = jwtTokenService;
    private readonly IPasswordHasher<User> _passwordHasher = passwordHasher;
    private readonly IAccountMessageSender _messageSender = messageSender;
    private readonly IConfiguration _configuration = configuration;
    private readonly TimeProvider _timeProvider = timeProvider;
    private readonly ILogger<AuthService> _logger = logger;

    public async Task<UserDto> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken)
    {
        if (request.Password != request.PasswordConfirmation)
            throw new BusinessValidationException("Password confirmation does not match.");
        if (!request.AcceptedTerms)
            throw new BusinessValidationException("Terms must be accepted to create an account.");

        var email = request.Email.Trim().ToLowerInvariant();
        var username = UsernameRules.Validate(request.Username);
        var normalizedUsername = UsernameRules.Normalize(username);
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var profile = new UserProfile
        {
            BirthDate = request.BirthDate,
            Gender = request.Gender,
            StartingWeight = request.StartingWeight,
            Height = request.Height,
            DailySteps = request.DailySteps,
            TrainingDaysPerWeek = request.TrainingDaysPerWeek,
            WorkoutDurationMinutes = request.WorkoutDurationMinutes,
            TrainingIntensity = request.TrainingIntensity,
            TimeZoneId = request.TimeZoneId
        };
        ProfileValidation.Validate(profile, now);
        var targetWeight = request.GoalType == GoalType.MaintainWeight
            ? request.StartingWeight : request.TargetWeight ?? 0m;
        var pace = request.GoalType == GoalType.MaintainWeight
            ? 0m : request.WeightChangePerWeek ?? 0m;

        if (await _context.Users.AnyAsync(user => user.Email == email, cancellationToken))
        {
            throw new ConflictException("An account with that email already exists.");
        }

        if (await _context.Users.AnyAsync(user => user.NormalizedUsername == normalizedUsername, cancellationToken))
        {
            throw new ConflictException("That username is already in use.");
        }

        var user = new User
        {
            Email = email,
            Username = username,
            PasswordHash = string.Empty,
            IsActive = false,
            CreatedAt = now
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        var goal = GoalCalculator.Calculate(0, profile, request.StartingWeight,
            request.GoalType, targetWeight, pace, now);
        var verificationToken = SecretToken.Create();

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.Users.Add(user);
        user.UserProfile = profile;
        user.UserGoals.Add(goal);
        user.UserSettings.Add(new UserSetting
        {
            SettingKey = SettingKey.Notifications,
            SettingValue = request.NotificationsEnabled ? "true" : "false",
            UpdatedAt = now
        });
        user.UserConsents.Add(new UserConsent
        {
            ConsentType = ConsentType.Terms,
            DocumentVersion = _configuration["Consent:TermsVersion"] ?? "1",
            GrantedAt = now
        });
        user.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            Email = email,
            TokenHash = SecretToken.Hash(verificationToken),
            CreatedAt = now,
            ExpiresAt = now.AddHours(24)
        });
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _messageSender.SendVerificationAsync(email, verificationToken, cancellationToken);

        _logger.LogInformation("User {UserId} registered", user.UserId);
        return ToUserDto(user);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        var username = UsernameRules.Normalize(request.Username);
        var user = await _context.Users
            .SingleOrDefaultAsync(user => user.NormalizedUsername == username, cancellationToken);

        if (user is null || !user.IsActive || user.EmailVerifiedAt is null || user.DeletedAt is not null)
        {
            throw new UnauthorizedException("Invalid username or password.");
        }

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            throw new UnauthorizedException("Invalid username or password.");
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        var response = await IssueTokensAsync(user, cancellationToken);
        _logger.LogInformation("User {UserId} logged in", user.UserId);
        return response;
    }

    public async Task<AuthResponse> RefreshAsync(RefreshRequest request, CancellationToken cancellationToken)
    {
        var identity = _jwtTokenService.ValidateRefreshToken(request.RefreshToken);
        var user = await _context.Users
            .SingleOrDefaultAsync(user => user.UserId == identity.UserId, cancellationToken);

        if (user is null || !user.IsActive || user.EmailVerifiedAt is null || user.DeletedAt is not null)
        {
            throw new UnauthorizedException("The account is not active.");
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        var claimed = await _context.RefreshTokens.Where(token => token.TokenId == identity.TokenId
                && token.UserId == identity.UserId && token.State == TokenState.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.State, TokenState.Used),
                cancellationToken);
        if (claimed != 1)
            throw new UnauthorizedException("The refresh token is no longer active.");
        var response = await IssueTokensAsync(user, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        _logger.LogInformation("Refresh token rotated for user {UserId}", user.UserId);
        return response;
    }

    public async Task LogoutAsync(int userId, string refreshToken, CancellationToken cancellationToken)
    {
        var identity = _jwtTokenService.ValidateRefreshToken(refreshToken, validateLifetime: false);
        if (identity.UserId != userId)
            throw new UnauthorizedAccessException("Refresh token does not belong to the current user.");
        var token = await _context.RefreshTokens
            .SingleOrDefaultAsync(
                candidate => candidate.TokenId == identity.TokenId
                    && candidate.UserId == identity.UserId,
                cancellationToken);

        if (token is null)
        {
            return;
        }

        token.State = TokenState.Revoked;
        await _context.SaveChangesAsync(cancellationToken);
        _logger.LogInformation("Refresh token revoked for user {UserId}", identity.UserId);
    }

    public async Task LogoutAllAsync(int userId, CancellationToken cancellationToken)
    {
        await _context.RefreshTokens
            .Where(token => token.UserId == userId && token.State == TokenState.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.State, TokenState.Revoked), cancellationToken);
    }

    public async Task VerifyEmailAsync(VerifyEmailRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || request.Token.Length != 64
            || !request.Token.All(char.IsAsciiHexDigit))
            throw new BusinessValidationException("The verification token is invalid or expired.");
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var hash = SecretToken.Hash(request.Token);
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        var token = await _context.EmailVerificationTokens.AsNoTracking()
            .SingleOrDefaultAsync(candidate => candidate.TokenHash == hash, cancellationToken);
        if (token is null)
            throw new BusinessValidationException("The verification token is invalid or expired.");
        // Lock the account first, consistently with resend and account changes.
        var updated = await _context.Users.Where(user => user.UserId == token.UserId
                && user.Email == token.Email && user.DeletedAt == null && user.EmailVerifiedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.EmailVerifiedAt, now)
                .SetProperty(user => user.IsActive, true), cancellationToken);
        var claimed = await _context.EmailVerificationTokens.Where(candidate => candidate.TokenHash == hash
                && candidate.UsedAt == null && candidate.ExpiresAt > now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.UsedAt, now), cancellationToken);
        if (updated != 1 || claimed != 1)
            throw new BusinessValidationException("The verification token is invalid or expired.");
        await _context.EmailVerificationTokens.Where(candidate => candidate.UserId == token.UserId && candidate.UsedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.UsedAt, now), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task ResendVerificationAsync(ResendVerificationRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        // A row update serializes concurrent resend/verification/email-change requests across API instances.
        var locked = await _context.Users.Where(candidate => candidate.Email == email
                && candidate.EmailVerifiedAt == null && candidate.DeletedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.IsActive, false), cancellationToken);
        if (locked != 1) return;
        var user = await _context.Users.AsNoTracking().SingleAsync(candidate => candidate.Email == email, cancellationToken);
        if (await _context.EmailVerificationTokens.AnyAsync(token => token.UserId == user.UserId
            && token.CreatedAt > now.AddMinutes(-1), cancellationToken)) return;
        var rawToken = SecretToken.Create();
        await _context.EmailVerificationTokens.Where(token => token.UserId == user.UserId && token.UsedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.UsedAt, now), cancellationToken);
        _context.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            UserId = user.UserId,
            Email = email,
            TokenHash = SecretToken.Hash(rawToken),
            CreatedAt = now,
            ExpiresAt = now.AddHours(24)
        });
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await _messageSender.SendVerificationAsync(email, rawToken, cancellationToken);
    }

    public async Task ForgotPasswordAsync(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.SingleOrDefaultAsync(candidate => candidate.Email == email, cancellationToken);
        if (user is null || !user.IsActive || user.DeletedAt is not null) return;

        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var rawToken = SecretToken.Create();
        await _context.PasswordResetTokens
            .Where(token => token.UserId == user.UserId && token.State == TokenState.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.State, TokenState.Revoked), cancellationToken);
        _context.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.UserId,
            TokenId = SecretToken.Hash(rawToken),
            State = TokenState.Active,
            CreatedAt = now,
            ExpiresAt = now.AddHours(1)
        });
        await _context.SaveChangesAsync(cancellationToken);
        await _messageSender.SendAsync(email, "Reset your FitnessApp password",
            $"Your password reset token is: {rawToken}", cancellationToken);
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        EnsureMatchingPasswords(request.NewPassword, request.NewPasswordConfirmation);
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var hash = SecretToken.Hash(request.Token);
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        var token = await _context.PasswordResetTokens.Include(candidate => candidate.User)
            .SingleOrDefaultAsync(candidate => candidate.TokenId == hash, cancellationToken);
        if (token is null || token.State != TokenState.Active || token.ExpiresAt <= now
            || token.User.DeletedAt is not null)
            throw new BusinessValidationException("The password reset token is invalid or expired.");

        token.State = TokenState.Used;
        token.User.PasswordHash = _passwordHasher.HashPassword(token.User, request.NewPassword);
        await _context.RefreshTokens
            .Where(candidate => candidate.UserId == token.UserId && candidate.State == TokenState.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(candidate => candidate.State, TokenState.Revoked), cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        EnsureMatchingPasswords(request.NewPassword, request.NewPasswordConfirmation);
        var user = await _context.Users.SingleOrDefaultAsync(candidate => candidate.UserId == userId
            && candidate.DeletedAt == null && candidate.IsActive, cancellationToken)
            ?? throw new UnauthorizedException("The account is not active.");
        if (_passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.CurrentPassword)
            == PasswordVerificationResult.Failed)
            throw new UnauthorizedException("Current password is invalid.");

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        user.PasswordHash = _passwordHasher.HashPassword(user, request.NewPassword);
        await _context.RefreshTokens
            .Where(token => token.UserId == userId && token.State == TokenState.Active)
            .ExecuteUpdateAsync(setters => setters.SetProperty(token => token.State, TokenState.Revoked), cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static void EnsureMatchingPasswords(string password, string confirmation)
    {
        if (password.Length < 10 || password != confirmation)
            throw new BusinessValidationException("Password must be at least 10 characters and match confirmation.");
    }

    private async Task<AuthResponse> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var accessToken = _jwtTokenService.CreateAccessToken(user.UserId, user.Email, user.Username);
        var refreshToken = _jwtTokenService.CreateRefreshToken(user.UserId);

        _context.RefreshTokens.Add(new RefreshToken
        {
            TokenId = refreshToken.TokenId,
            UserId = user.UserId,
            State = TokenState.Active
        });

        await _context.SaveChangesAsync(cancellationToken);

        return new AuthResponse(
            accessToken.Value,
            accessToken.ExpiresAt,
            refreshToken.Value,
            refreshToken.ExpiresAt,
            ToUserDto(user));
    }

    private static UserDto ToUserDto(User user)
    {
        return new UserDto(
            user.UserId,
            user.Email,
            user.Username,
            user.IsActive,
            user.EmailVerifiedAt,
            user.CreatedAt);
    }
}
