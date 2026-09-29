using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Goals;

public sealed record CreateUserGoalRequest(
    GoalType GoalType,
    decimal TargetWeight,
    decimal WeightChangePerWeek);
