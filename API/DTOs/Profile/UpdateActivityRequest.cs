namespace FitnessApp.Api.DTOs.Profile;

public sealed record UpdateActivityRequest(int DailySteps, bool FromHealthIntegration = false);
