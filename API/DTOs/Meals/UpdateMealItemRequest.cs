using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record UpdateMealItemRequest(
    int? FoodId,
    decimal? Quantity,
    QuantityUnit? Unit);
