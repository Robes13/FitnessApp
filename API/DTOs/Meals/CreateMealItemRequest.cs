using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record CreateMealItemRequest(
    int FoodId,
    decimal Quantity,
    QuantityUnit Unit);
