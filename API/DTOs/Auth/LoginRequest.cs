using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record LoginRequest
{
    [Required, MaxLength(320)]
    public required string EmailOrUsername { get; init; }

    [Required, MaxLength(200)]
    public required string Password { get; init; }
}
