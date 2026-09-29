using FitnessApp.Api.DTOs.Goals;

namespace FitnessApp.Api.DTOs.Nutrition;

public sealed record NutritionDayDto(
    DateOnly Date,
    NutritionTotalsDto Consumed,
    UserGoalDto? Goal,
    NutritionTotalsDto? Remaining);
