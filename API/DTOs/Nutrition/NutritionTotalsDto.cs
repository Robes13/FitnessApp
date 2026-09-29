namespace FitnessApp.Api.DTOs.Nutrition;

public sealed record NutritionTotalsDto(
    decimal Calories,
    decimal Protein,
    decimal Carbohydrates,
    decimal Fat);
