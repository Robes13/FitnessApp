using System.ComponentModel.DataAnnotations;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Utilities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitnessApp.Api.Tests;

public sealed partial class ApiWorkflowTests
{
    private static AuthService UsernameAuth(TestDatabase database, CapturingSender sender)
        => new(database.Context, new JwtTokenService(
            Microsoft.Extensions.Options.Options.Create(new JwtOptions { Issuer = "test", Audience = "test", SigningKey = new string('x', 64) }),
            Microsoft.Extensions.Options.Options.Create(new RefreshTokenOptions { LifetimeDays = 30 }), TimeProvider.System),
            new PasswordHasher<User>(), sender, new ConfigurationBuilder().Build(), TimeProvider.System, NullLogger<AuthService>.Instance);

    private static RegisterRequest UsernameRegistration(string username, string email) => new()
    {
        Username = username, Email = email, Password = "LongEnoughPassword1!", PasswordConfirmation = "LongEnoughPassword1!",
        BirthDate = new DateOnly(2000, 1, 1), Gender = Gender.Female, StartingWeight = 70, Height = 170,
        DailySteps = 5000, TrainingDaysPerWeek = 3, WorkoutDurationMinutes = 45,
        TrainingIntensity = TrainingIntensity.Moderate, GoalType = GoalType.MaintainWeight,
        AcceptedTerms = true, TimeZoneId = "UTC"
    };

    [Fact]
    public async Task SignupVerifyUsernameLoginAndEmailRecoveryWorkTogether()
    {
        await using var database = await TestDatabase.CreateAsync();
        var sender = new CapturingSender();
        var auth = UsernameAuth(database, sender);
        var request = UsernameRegistration("JohnDoe", "john@example.com");
        var registered = await auth.RegisterAsync(request, default);
        Assert.Equal("JohnDoe", registered.Username);
        Assert.Equal(request.Email, registered.Email);
        Assert.False(registered.EmailVerified);
        Assert.Equal("johndoe", (await database.Context.Users.AsNoTracking().SingleAsync()).NormalizedUsername);
        await Assert.ThrowsAsync<ConflictException>(() => auth.RegisterAsync(UsernameRegistration("JOHNDOE", "other@example.com"), default));
        await Assert.ThrowsAsync<UnauthorizedException>(() => auth.LoginAsync(new() { Username = "johndoe", Password = request.Password }, default));
        await auth.VerifyEmailAsync(new(sender.Messages.Single()), default);
        database.Context.ChangeTracker.Clear();
        var login = await auth.LoginAsync(new() { Username = "JOHNDOE", Password = request.Password }, default);
        Assert.True(login.User.EmailVerified);
        Assert.NotEmpty(login.AccessToken);
        Assert.NotEmpty(login.RefreshToken);
        sender.Messages.Clear();
        await auth.ForgotPasswordAsync(new(request.Email), default);
        var reset = sender.Messages.Single().Split(' ').Last();
        await auth.ResetPasswordAsync(new(reset, "NewSecurePassword1!", "NewSecurePassword1!"), default);
        var updated = await auth.LoginAsync(new() { Username = "johndoe", Password = "NewSecurePassword1!" }, default);
        Assert.Equal(request.Email, updated.User.Email);
    }

    [Theory]
    [InlineData("missing", "LongEnoughPassword1!")]
    [InlineData("JohnDoe", "incorrect")]
    [InlineData("john@example.com", "LongEnoughPassword1!")]
    public async Task LoginFailuresAreGenericAndEmailIsNotAFallback(string username, string password)
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context, "JohnDoe");
        user.Email = "john@example.com";
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, "LongEnoughPassword1!");
        await database.Context.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<UnauthorizedException>(() => UsernameAuth(database, new CapturingSender())
            .LoginAsync(new() { Username = username, Password = password }, default));
        Assert.Equal("Invalid username or password.", error.Message);
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("has space")]
    [InlineData("john\n")]
    [InlineData("user@example.com")]
    [InlineData("éclair")]
    public void UsernamesRejectInvalidCharacters(string username)
        => Assert.Throws<BusinessValidationException>(() => UsernameRules.Validate(username));

    [Fact]
    public void LoginContractRequiresUsernameButNoEmail()
    {
        var request = new LoginRequest { Username = "JohnDoe", Password = "password" };
        Assert.True(Validator.TryValidateObject(request, new ValidationContext(request), [], true));
        Assert.Null(typeof(LoginRequest).GetProperty("Email"));
        var missing = request with { Username = "" };
        Assert.False(Validator.TryValidateObject(missing, new ValidationContext(missing), [], true));
    }

    [Fact]
    public async Task DatabaseRejectsCaseCollisionsWithoutServiceValidation()
    {
        await using var database = await TestDatabase.CreateAsync();
        await SeedUserAsync(database.Context, "JohnDoe");
        await Assert.ThrowsAsync<DbUpdateException>(() => SeedUserAsync(database.Context, "johndoe"));
    }

    [Fact]
    public async Task ExistingUsernameChangesKeepNormalizationAndUniqueness()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context, "JohnDoe");
        await SeedUserAsync(database.Context, "Taken");
        var accounts = new UserAccountService(database.Context, TimeProvider.System, new CapturingSender(),
            new FakeImageStorage(), NullLogger<UserAccountService>.Instance);
        await Assert.ThrowsAsync<ConflictException>(() => accounts.UpdateAsync(user.UserId, new(null, "TAKEN"), default));
        var updated = await accounts.UpdateAsync(user.UserId, new(null, "New_Name"), default);
        Assert.Equal("New_Name", updated.Username);
        Assert.Equal("new_name", (await database.Context.Users.AsNoTracking().SingleAsync(u => u.UserId == user.UserId)).NormalizedUsername);
        Assert.Equal(user.Email, updated.Email);
        Assert.NotNull(updated.EmailVerifiedAt);
    }

    [Fact]
    public async Task LegacyUsernameDisplayAndAccountArePreserved()
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context, "Legacy Name");
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, "LongEnoughPassword1!");
        await database.Context.SaveChangesAsync();
        var login = await UsernameAuth(database, new CapturingSender()).LoginAsync(
            new() { Username = "LEGACY NAME", Password = "LongEnoughPassword1!" }, default);
        Assert.Equal(user.UserId, login.User.UserId);
        Assert.Equal("Legacy Name", login.User.Username);
        Assert.Equal(user.Email, login.User.Email);
    }
}
