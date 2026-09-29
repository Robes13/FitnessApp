using FitnessApp.Api.DTOs.Nutrition;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record MealCollectionDto(
    int MealCollectionId,
    string Name,
    DateTime CreatedAt,
    IReadOnlyList<MealItemDto> Items,
    NutritionTotalsDto Totals);
