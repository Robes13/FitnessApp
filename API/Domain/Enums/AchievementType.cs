using FitnessApp.Api.Domain.Attributes;

namespace FitnessApp.Api.Domain.Enums;

public enum AchievementType
{
    [StringValue("First Meal")]
    [CompletionRequirement(1)]
    FirstMeal = 1,

    [StringValue("Ten Meals")]
    [CompletionRequirement(10)]
    TenMeals = 2,

    [StringValue("Ten Weights")]
    [CompletionRequirement(10)]
    TenWeights = 3
}
