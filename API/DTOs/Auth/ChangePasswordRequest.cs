using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(10)] string NewPassword,
    [Required] string NewPasswordConfirmation);
