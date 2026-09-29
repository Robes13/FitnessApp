using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Profile;

public sealed record UserProfileDto(
    int UserProfileId,
    int UserId,
    DateOnly BirthDate,
    Gender Gender,
    decimal Height,
    decimal StartingWeight,
    int DailySteps,
    int TrainingDaysPerWeek,
    int WorkoutDurationMinutes,
    TrainingIntensity TrainingIntensity,
    string TimeZoneId,
    string? ProfileImageUrl);
