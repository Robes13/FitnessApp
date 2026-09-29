namespace FitnessApp.Api.DTOs.Weights;

public sealed record CreateWeightLogRequest(
    decimal Weight,
    DateTime RecordedAt);
