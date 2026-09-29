using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Foods;

public sealed record UpsertFoodServingRequest(
    ServingUnit Unit,
    decimal GramsPerUnit);
