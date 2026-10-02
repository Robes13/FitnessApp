using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace FitnessApp.Api.Services.Auth;

public sealed class JwtTokenService(IOptions<JwtOptions> options, IOptions<RefreshTokenOptions> refreshOptions, TimeProvider timeProvider) : IJwtTokenService
{
    private readonly JwtOptions _options = options.Value;
    private readonly RefreshTokenOptions _refreshOptions = refreshOptions.Value;
    private readonly TimeProvider _timeProvider = timeProvider;

    public IssuedToken CreateAccessToken(int userId, string email, string username)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var expiresAt = now.AddMinutes(_options.AccessTokenMinutes);
        var tokenId = Guid.NewGuid().ToString("N");

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, email),
            new Claim(ClaimTypes.Name, username),
            new Claim(JwtRegisteredClaimNames.Jti, tokenId),
            new Claim("token_type", "access")
        };

        return CreateToken(claims, tokenId, now, expiresAt);
    }

    public IssuedToken CreateRefreshToken(int userId)
    {
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var expiresAt = now.AddDays(_refreshOptions.LifetimeDays);
        var tokenId = Guid.NewGuid().ToString("N");

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, tokenId),
            new Claim("token_type", "refresh")
        };

        return CreateToken(claims, tokenId, now, expiresAt);
    }

    public RefreshTokenIdentity ValidateRefreshToken(string token, bool validateLifetime = true)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, CreateValidationParameters(validateLifetime), out var validatedToken);

            if (validatedToken is not JwtSecurityToken jwt
                || !string.Equals(jwt.Header.Alg, SecurityAlgorithms.HmacSha256, StringComparison.Ordinal))
            {
                throw new UnauthorizedException("The refresh token is invalid.");
            }

            var tokenType = principal.FindFirst("token_type")?.Value;
            var userIdValue = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            var tokenId = principal.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

            if (tokenType != "refresh"
                || !int.TryParse(userIdValue, out var userId)
                || string.IsNullOrWhiteSpace(tokenId))
            {
                throw new UnauthorizedException("The refresh token is invalid.");
            }

            return new RefreshTokenIdentity(userId, tokenId, jwt.ValidFrom, jwt.ValidTo);
        }
        catch (SecurityTokenException)
        {
            throw new UnauthorizedException("The refresh token is invalid or expired.");
        }
        catch (ArgumentException)
        {
            throw new UnauthorizedException("The refresh token is invalid.");
        }
    }

    private IssuedToken CreateToken(IEnumerable<Claim> claims, string tokenId, DateTime issuedAt, DateTime expiresAt)
    {
        var credentials = new SigningCredentials(GetSigningKey(), SecurityAlgorithms.HmacSha256);
        var jwt = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: issuedAt,
            expires: expiresAt,
            signingCredentials: credentials);

        return new IssuedToken(new JwtSecurityTokenHandler().WriteToken(jwt), tokenId, expiresAt);
    }

    private TokenValidationParameters CreateValidationParameters(bool validateLifetime)
    {
        return new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _options.Issuer,
            ValidateAudience = true,
            ValidAudience = _options.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = GetSigningKey(),
            ValidateLifetime = validateLifetime,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
    }

    private SymmetricSecurityKey GetSigningKey()
    {
        if (string.IsNullOrWhiteSpace(_options.SigningKey) || _options.SigningKey.Length < 32)
        {
            throw new InvalidOperationException("Jwt:SigningKey must be configured with at least 32 characters.");
        }

        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
    }
}
