using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Goals;

namespace FitnessApp.Api.DTOs.Nutrition;

public sealed record NutritionHistoryItemDto(
    FoodLogDto FoodLog,
    UserGoalDto? GoalAtConsumption);
