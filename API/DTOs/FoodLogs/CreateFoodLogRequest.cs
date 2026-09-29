using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.FoodLogs;

public sealed record CreateFoodLogRequest(
    int FoodId,
    decimal Quantity,
    QuantityUnit Unit,
    DateTime ConsumedAt);
