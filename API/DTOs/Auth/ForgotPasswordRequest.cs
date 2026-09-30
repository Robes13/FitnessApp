using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record ForgotPasswordRequest([Required, MaxLength(320)] string EmailOrUsername);
