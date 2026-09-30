using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record VerifyEmailRequest([Required, StringLength(64, MinimumLength = 64), RegularExpression("^[0-9A-Fa-f]{64}$")] string Token);
