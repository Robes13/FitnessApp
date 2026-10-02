namespace FitnessApp.Api.Services.Auth;

public interface IJwtTokenService
{
    IssuedToken CreateAccessToken(int userId, string email, string username);
    IssuedToken CreateRefreshToken(int userId);
    RefreshTokenIdentity ValidateRefreshToken(string token, bool validateLifetime = true);
}

public sealed record IssuedToken(string Value, string TokenId, DateTime ExpiresAt);
public sealed record RefreshTokenIdentity(int UserId, string TokenId, DateTime IssuedAt, DateTime ExpiresAt);
