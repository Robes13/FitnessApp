using FitnessApp.Api.Utilities;
using System.ComponentModel.DataAnnotations;
using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Auth;

public sealed record RegisterRequest
{
    [Required, EmailAddress, MaxLength(320)]
    public required string Email { get; init; }

    [Required, MinLength(3), MaxLength(50)]
    [RegularExpression(UsernameRules.Pattern, ErrorMessage = UsernameRules.Message)]
    public required string Username { get; init; }

    [Required, MinLength(10), MaxLength(200)]
    public required string Password { get; init; }

    [Required]
    public required string PasswordConfirmation { get; init; }

    public DateOnly BirthDate { get; init; }
    public Gender Gender { get; init; }
    public decimal StartingWeight { get; init; }
    public decimal Height { get; init; }
    public int DailySteps { get; init; }
    public int TrainingDaysPerWeek { get; init; }
    public int WorkoutDurationMinutes { get; init; }
    public TrainingIntensity TrainingIntensity { get; init; }
    public GoalType GoalType { get; init; }
    public decimal? TargetWeight { get; init; }
    public decimal? WeightChangePerWeek { get; init; }
    public bool NotificationsEnabled { get; init; }
    public bool AcceptedTerms { get; init; }
    [Required, MaxLength(100)]
    public required string TimeZoneId { get; init; }
}
