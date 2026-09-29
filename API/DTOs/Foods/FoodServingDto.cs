using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Foods;

public sealed record FoodServingDto(
    int FoodServingId,
    ServingUnit Unit,
    decimal GramsPerUnit);
