using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Profile;

public sealed record UpsertUserProfileRequest(
    DateOnly BirthDate,
    Gender Gender,
    decimal Height,
    int DailySteps,
    int TrainingDaysPerWeek,
    int WorkoutDurationMinutes,
    TrainingIntensity TrainingIntensity,
    string? TimeZoneId = null);
