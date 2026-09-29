using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record ResendVerificationRequest([Required, EmailAddress] string Email);
