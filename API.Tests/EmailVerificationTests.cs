using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace FitnessApp.Api.Tests;

public sealed partial class ApiWorkflowTests
{
    private static async Task<(User User, string Token)> SeedVerificationAsync(TestDatabase database)
    {
        var user = await SeedUserAsync(database.Context);
        user.IsActive = false;
        user.EmailVerifiedAt = null;
        var raw = SecretToken.Create();
        database.Context.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            UserId = user.UserId, Email = user.Email, TokenHash = SecretToken.Hash(raw),
            CreatedAt = DateTime.UtcNow.AddMinutes(-2), ExpiresAt = DateTime.UtcNow.AddHours(24)
        });
        await database.Context.SaveChangesAsync();
        database.Context.ChangeTracker.Clear();
        return (user, raw);
    }

    [Fact]
    public async Task VerificationPersistsAndTokenCannotBeReused()
    {
        await using var database = await TestDatabase.CreateAsync();
        var (_, raw) = await SeedVerificationAsync(database);
        var auth = CreateAuth(database.Context, new CapturingSender());
        await auth.VerifyEmailAsync(new(raw), default);
        var persisted = await database.Context.Users.AsNoTracking().SingleAsync();
        Assert.True(persisted.IsActive);
        Assert.NotNull(persisted.EmailVerifiedAt);
        Assert.NotNull((await database.Context.EmailVerificationTokens.AsNoTracking().SingleAsync()).UsedAt);
        await Assert.ThrowsAsync<BusinessValidationException>(() => auth.VerifyEmailAsync(new(raw), default));
    }

    [Theory]
    [InlineData("")]
    [InlineData("malformed")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task InvalidVerificationIsRejected(string raw)
    {
        await using var database = await TestDatabase.CreateAsync();
        await SeedVerificationAsync(database);
        await Assert.ThrowsAsync<BusinessValidationException>(() => CreateAuth(database.Context, new CapturingSender())
            .VerifyEmailAsync(new(raw), default));
        Assert.Null((await database.Context.Users.AsNoTracking().SingleAsync()).EmailVerifiedAt);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("deleted")]
    [InlineData("email-changed")]
    [InlineData("already-verified")]
    public async Task UnusableVerificationIsRejected(string reason)
    {
        await using var database = await TestDatabase.CreateAsync();
        var (_, raw) = await SeedVerificationAsync(database);
        var user = await database.Context.Users.SingleAsync();
        var token = await database.Context.EmailVerificationTokens.SingleAsync();
        if (reason == "expired") token.ExpiresAt = DateTime.UtcNow.AddSeconds(-1);
        if (reason == "deleted") user.DeletedAt = DateTime.UtcNow;
        if (reason == "email-changed") user.Email = "changed@example.com";
        if (reason == "already-verified") user.EmailVerifiedAt = DateTime.UtcNow;
        await database.Context.SaveChangesAsync();
        database.Context.ChangeTracker.Clear();
        await Assert.ThrowsAsync<BusinessValidationException>(() => CreateAuth(database.Context, new CapturingSender())
            .VerifyEmailAsync(new(raw), default));
        Assert.Equal(reason == "already-verified",
            (await database.Context.Users.AsNoTracking().SingleAsync()).EmailVerifiedAt is not null);
    }

    [Fact]
    public async Task ResendSupersedesOldTokenAndEnforcesCooldown()
    {
        await using var database = await TestDatabase.CreateAsync();
        var (user, raw) = await SeedVerificationAsync(database);
        var sender = new CapturingSender();
        var auth = CreateAuth(database.Context, sender);
        await auth.ResendVerificationAsync(new(user.Email), default);
        await auth.ResendVerificationAsync(new(user.Email), default);
        var fresh = TokenFrom(Assert.Single(sender.Sent).Body);
        Assert.NotEqual(raw, fresh);
        await Assert.ThrowsAsync<BusinessValidationException>(() => auth.VerifyEmailAsync(new(raw), default));
        await auth.VerifyEmailAsync(new(fresh), default);
        await auth.ResendVerificationAsync(new(user.Email), default);
        Assert.Single(sender.Sent);
    }

    [Fact]
    public async Task ChangingEmailInvalidatesOldTokenAndVerifiesOnlyNewAddress()
    {
        await using var database = await TestDatabase.CreateAsync();
        var (user, raw) = await SeedVerificationAsync(database);
        var sender = new CapturingSender();
        var account = new UserAccountService(database.Context, TimeProvider.System, sender,
            new FakeImageStorage(), AppSettings, NullLogger<UserAccountService>.Instance);
        var response = await account.UpdateAsync(user.UserId, new("new@example.com", null), default);
        // The address only changes when the link sent to the new one is used.
        Assert.Equal(user.Email, response.Email);
        Assert.Equal("new@example.com", Assert.Single(sender.Sent).Email);
        database.Context.ChangeTracker.Clear();
        var auth = CreateAuth(database.Context, sender);
        await Assert.ThrowsAsync<BusinessValidationException>(() => auth.VerifyEmailAsync(new(raw), default));
        await auth.VerifyEmailAsync(new(TokenFrom(sender.Sent[0].Body)), default);
        var persisted = await database.Context.Users.AsNoTracking().SingleAsync();
        Assert.Equal("new@example.com", persisted.Email);
        Assert.NotNull(persisted.EmailVerifiedAt);
    }

    [Fact]
    public void TemplateContainsClickableLinkAndPlainTextFallback()
    {
        var token = SecretToken.Create();
        var url = "https://eldorado-fts.dk/api/v1/auth/email/verify?token=" + token;
        var mail = AccountEmails.Verification("https://eldorado-fts.dk/", token);
        Assert.Contains("Nutrify", mail.Subject);
        Assert.Contains($"<a href=\"{url}\">", mail.Html);
        Assert.Contains("<meta charset=\"utf-8\">", mail.Html);
        Assert.Contains(url, mail.Text);
        Assert.Contains("24 timer", mail.Text);
        Assert.Contains("24 hours", mail.Html);
    }
}
