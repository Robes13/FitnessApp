using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record ResendVerificationRequest([Required, MaxLength(320)] string EmailOrUsername);
