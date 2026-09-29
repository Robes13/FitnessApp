using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Settings;

public sealed record UserSettingDto(
    SettingKey SettingKey,
    string SettingValue,
    DateTime UpdatedAt);
