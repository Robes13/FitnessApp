namespace FitnessApp.Api.DTOs.Weights;

public sealed record UpdateWeightLogRequest(
    decimal? Weight,
    DateTime? RecordedAt);
