using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record RefreshRequest
{
    [Required]
    public required string RefreshToken { get; init; }
}
