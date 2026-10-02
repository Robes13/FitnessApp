using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Goals;
using FitnessApp.Api.DTOs.Weights;

namespace FitnessApp.Api.DTOs.History;

public sealed record HistoryEventDto(
    HistoryEventType Type,
    DateTime OccurredAt,
    int ReferenceId,
    FoodLogDto? FoodLog = null,
    WeightLogDto? WeightLog = null,
    UserGoalDto? Goal = null);
