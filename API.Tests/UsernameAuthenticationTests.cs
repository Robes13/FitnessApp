using System.ComponentModel.DataAnnotations;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Utilities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitnessApp.Api.Tests;

public sealed partial class ApiWorkflowTests
{
    [Fact]
    public async Task SignupVerifyUsernameLoginAndEmailRecoveryWorkTogether()
    {
        await using var database = await TestDatabase.CreateAsync();
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        var request = CreateRegisterRequest() with { Username = "JohnDoe", Email = "john@example.com" };
        var registered = await auth.RegisterAsync(request, default);
        Assert.Equal("JohnDoe", registered.Username);
        Assert.Equal(request.Email, registered.Email);
        Assert.Null(registered.EmailVerifiedAt);
        Assert.Equal("johndoe", (await database.Context.Users.AsNoTracking().SingleAsync()).NormalizedUsername);
        var conflict = await Assert.ThrowsAsync<ConflictException>(() => auth.RegisterAsync(
            request with { Username = "JOHNDOE", Email = "other@example.com" }, default));
        Assert.Equal("That username is already in use.", conflict.Message);
        // Right password, unverified e-mail: 403, never tokens.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => LoginAsync(auth, "johndoe", request.Password));
        await auth.VerifyEmailAsync(new(TokenFrom(sender.Sent.Single().Body)), default);
        database.Context.ChangeTracker.Clear();
        var login = await LoginAsync(auth, "JOHNDOE", request.Password);
        Assert.NotNull(login.User.EmailVerifiedAt);
        Assert.NotEmpty(login.AccessToken);
        Assert.NotEmpty(login.RefreshToken);
        sender.Sent.Clear();
        await auth.ForgotPasswordAsync(new(request.Email), default);
        var reset = TokenFrom(sender.Sent.Single().Body);
        await auth.ResetPasswordAsync(new(reset, "NewSecurePassword1!", "NewSecurePassword1!"), default);
        var updated = await LoginAsync(auth, "johndoe", "NewSecurePassword1!");
        Assert.Equal(request.Email, updated.User.Email);
    }

    [Theory]
    [InlineData("missing", Password)]
    [InlineData("JohnDoe", "incorrect")]
    [InlineData("john@example.com", "incorrect")]
    [InlineData("missing@example.com", Password)]
    public async Task LoginFailuresAreGeneric(string identifier, string password)
    {
        await using var database = await TestDatabase.CreateAsync();
        var user = await SeedUserAsync(database.Context, "JohnDoe");
        user.Email = "john@example.com";
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Password);
        await database.Context.SaveChangesAsync();
        var error = await Assert.ThrowsAsync<UnauthorizedException>(() => LoginAsync(
            CreateAuth(database.Context, new CapturingSender()), identifier, password));
        Assert.Equal("Invalid credentials.", error.Message);
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
    public void LoginContractRequiresAnIdentifierOfAtMost320Characters()
    {
        var request = new LoginRequest { EmailOrUsername = "JohnDoe", Password = "password" };
        Assert.True(Validator.TryValidateObject(request, new ValidationContext(request), [], true));
        foreach (var invalid in new[] { request with { EmailOrUsername = "" }, request with { EmailOrUsername = new string('a', 321) } })
            Assert.False(Validator.TryValidateObject(invalid, new ValidationContext(invalid), [], true));
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
            new FakeImageStorage(), AppSettings, NullLogger<UserAccountService>.Instance);
        await Assert.ThrowsAsync<ConflictException>(() => accounts.UpdateAsync(user.UserId, new(null, "TAKEN"), default));
        await Assert.ThrowsAsync<BusinessValidationException>(() => accounts.UpdateAsync(user.UserId, new(null, "a@b"), default));
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
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Password);
        await database.Context.SaveChangesAsync();
        var login = await LoginAsync(CreateAuth(database.Context, new CapturingSender()), "LEGACY NAME", Password);
        Assert.Equal(user.UserId, login.User.UserId);
        Assert.Equal("Legacy Name", login.User.Username);
        Assert.Equal(user.Email, login.User.Email);
    }
}
