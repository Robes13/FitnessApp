namespace FitnessApp.Api.DTOs.Weights;

public sealed record LatestWeightDto(int? WeightLogId, decimal Weight, DateTime RecordedAt, bool IsStartingWeight);
