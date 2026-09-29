namespace FitnessApp.Api.DTOs.Meals;

public sealed record LogMealCollectionRequest(
    DateTime ConsumedAt,
    decimal Multiplier = 1m);
