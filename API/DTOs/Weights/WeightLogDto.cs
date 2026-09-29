namespace FitnessApp.Api.DTOs.Weights;

public sealed record WeightLogDto(
    int WeightLogId,
    decimal Weight,
    DateTime RecordedAt,
    DateOnly RecordedDate);
