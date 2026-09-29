using FitnessApp.Api.DTOs.Achievements;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.DTOs.Consent;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Foods;
using FitnessApp.Api.DTOs.Goals;
using FitnessApp.Api.DTOs.Meals;
using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.DTOs.Reminders;
using FitnessApp.Api.DTOs.Settings;
using FitnessApp.Api.DTOs.Weights;

namespace FitnessApp.Api.DTOs.Export;

public sealed record UserDataExportDto(
    UserDto Account,
    UserProfileDto? Profile,
    IReadOnlyList<UserGoalDto> Goals,
    IReadOnlyList<FoodDto> Foods,
    IReadOnlyList<FoodLogDto> FoodLogs,
    IReadOnlyList<WeightLogDto> WeightLogs,
    IReadOnlyList<MealCollectionDto> MealCollections,
    IReadOnlyList<ReminderDto> Reminders,
    IReadOnlyList<UserSettingDto> Settings,
    IReadOnlyList<AchievementDto> Achievements,
    IReadOnlyList<UserConsentDto> Consents);
