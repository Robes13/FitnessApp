namespace FitnessApp.Api.DTOs.Metadata;

public sealed record MetadataDto(
    IReadOnlyList<string> Genders,
    IReadOnlyList<string> TrainingIntensities,
    IReadOnlyList<string> GoalTypes,
    IReadOnlyList<string> ReminderTypes,
    IReadOnlyList<string> ServingUnits,
    IReadOnlyList<string> QuantityUnits,
    IReadOnlyList<string> SettingKeys,
    IReadOnlyList<string> AchievementTypes,
    IReadOnlyList<string> ConsentTypes);
