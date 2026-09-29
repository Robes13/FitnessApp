using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.FoodLogs;

public sealed record UpdateFoodLogRequest(
    int? FoodId,
    decimal? Quantity,
    QuantityUnit? Unit,
    DateTime? ConsumedAt);
