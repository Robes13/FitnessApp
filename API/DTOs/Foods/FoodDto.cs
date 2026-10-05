namespace FitnessApp.Api.DTOs.Foods;

public sealed record FoodDto(
    int FoodId,
    string Name,
    string? Barcode,
    decimal CaloriesPer100,
    decimal ProteinPer100,
    decimal CarbohydratesPer100,
    decimal FatPer100,
    int? CreatedByUserId,
    DateTime CreatedAt,
    IReadOnlyList<FoodServingDto> Servings);
