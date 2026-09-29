using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record MealItemDto(
    int MealItemId,
    int FoodId,
    string FoodName,
    decimal Quantity,
    QuantityUnit Unit);
