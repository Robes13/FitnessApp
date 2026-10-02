namespace FitnessApp.Api.DTOs.Auth;

public sealed record UserDto(
    int UserId,
    string Email,
    string Username,
    bool IsActive,
    DateTime? EmailVerifiedAt,
    DateTime CreatedAt);
