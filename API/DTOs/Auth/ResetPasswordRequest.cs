using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record ResetPasswordRequest(
    [Required] string Token,
    [Required, MinLength(10)] string NewPassword,
    [Required] string NewPasswordConfirmation);
