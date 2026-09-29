using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Metadata;

namespace FitnessApp.Api.Services.Metadata;

public sealed class MetadataService
{
    public MetadataDto Get() => new(
        Enum.GetNames<Gender>(),
        Enum.GetNames<TrainingIntensity>(),
        Enum.GetNames<GoalType>(),
        Enum.GetNames<ReminderType>(),
        Enum.GetNames<ServingUnit>(),
        Enum.GetNames<QuantityUnit>(),
        Enum.GetNames<SettingKey>(),
        Enum.GetNames<AchievementType>(),
        Enum.GetNames<ConsentType>());
}
