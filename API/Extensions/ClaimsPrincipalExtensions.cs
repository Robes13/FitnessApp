using System.Security.Claims;
using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;

        if (!int.TryParse(value, out var userId))
        {
            throw new UnauthorizedException("The authenticated user identifier is missing or invalid.");
        }

        return userId;
    }
}
