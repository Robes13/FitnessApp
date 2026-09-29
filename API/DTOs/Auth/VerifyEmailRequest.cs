using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record VerifyEmailRequest([Required] string Token);
