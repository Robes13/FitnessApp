using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record UpdateAccountRequest(
    [EmailAddress, MaxLength(320)] string? Email,
    [MinLength(3), MaxLength(50)] string? Username);
