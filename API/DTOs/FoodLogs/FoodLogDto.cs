using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.FoodLogs;

public sealed record FoodLogDto(
    int FoodLogId,
    int FoodId,
    string FoodName,
    decimal Quantity,
    QuantityUnit Unit,
    decimal CaloriesConsumed,
    decimal ProteinConsumed,
    decimal CarbohydratesConsumed,
    decimal FatConsumed,
    DateTime ConsumedAt);
