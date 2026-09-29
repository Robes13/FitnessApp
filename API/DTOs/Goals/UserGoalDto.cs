using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Goals;

public sealed record UserGoalDto(
    int UserGoalId,
    GoalType GoalType,
    decimal TargetWeight,
    decimal WeightChangePerWeek,
    decimal TargetDailyCalories,
    decimal TargetProtein,
    decimal TargetCarbohydrates,
    decimal TargetFat,
    DateTime CreatedAt);
