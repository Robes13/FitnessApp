using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.History;

public sealed record HistoryEventDto(
    HistoryEventType Type,
    DateTime OccurredAt,
    int ReferenceId);
