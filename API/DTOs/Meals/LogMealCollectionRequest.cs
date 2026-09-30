using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record LogMealCollectionRequest(
    DateTime ConsumedAt,
    MealType MealType,
    decimal Multiplier = 1m);
