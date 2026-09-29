using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record ForgotPasswordRequest([Required, EmailAddress] string Email);
