using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Achievements;

public sealed record AchievementDto(
    AchievementType AchievementType,
    string Name,
    int Progress,
    int CompletionRequirement,
    DateTime? CompletedAt);
