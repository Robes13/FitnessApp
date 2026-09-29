using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Services.Goals;

// Mifflin-St Jeor BMR, an activity multiplier from steps and scheduled exercise,
// 7,700 kcal/kg weight change, and a 30/40/30 protein/carbohydrate/fat split.
public static class GoalCalculator
{
    public static UserGoal Calculate(
        int userId,
        UserProfile profile,
        decimal currentWeight,
        GoalType goalType,
        decimal targetWeight,
        decimal weightChangePerWeek,
        DateTime now)
    {
        if (currentWeight is < 25m or > 400m || targetWeight is < 25m or > 400m)
        {
            throw new BusinessValidationException("Weight must be between 25 and 400 kg.");
        }

        if (!Enum.IsDefined(goalType) || weightChangePerWeek is < 0m or > 1m)
        {
            throw new BusinessValidationException("Goal type or change pace is invalid.");
        }

        if (goalType == GoalType.MaintainWeight)
        {
            if (weightChangePerWeek != 0m || targetWeight != currentWeight)
            {
                throw new BusinessValidationException("A maintenance goal must use the current weight and zero change pace.");
            }
        }
        else if (weightChangePerWeek == 0m
            || (goalType == GoalType.LoseWeight && targetWeight >= currentWeight)
            || (goalType == GoalType.GainWeight && targetWeight <= currentWeight))
        {
            throw new BusinessValidationException("Target weight and change pace must match the selected goal.");
        }

        var age = now.Year - profile.BirthDate.Year;
        if (profile.BirthDate > DateOnly.FromDateTime(now).AddYears(-age)) age--;
        if (age is < 13 or > 100 || profile.Height is < 100m or > 250m)
        {
            throw new BusinessValidationException("Age must be 13–100 years and height 100–250 cm.");
        }

        var sexAdjustment = profile.Gender switch
        {
            Gender.Male => 5m,
            Gender.Female => -161m,
            _ => -78m
        };
        var basalMetabolicRate = 10m * currentWeight + 6.25m * profile.Height - 5m * age + sexAdjustment;
        var stepActivity = Math.Min(profile.DailySteps / 10000m * 0.30m, 0.45m);
        var exerciseIntensity = profile.TrainingIntensity switch
        {
            TrainingIntensity.Low => 0.08m,
            TrainingIntensity.Moderate => 0.12m,
            TrainingIntensity.High => 0.16m,
            _ => throw new BusinessValidationException("Training intensity is invalid.")
        };
        var exerciseActivity = profile.TrainingDaysPerWeek * profile.WorkoutDurationMinutes / 420m * exerciseIntensity;
        var multiplier = Math.Min(2.4m, 1.2m + stepActivity + exerciseActivity);
        var dailyAdjustment = weightChangePerWeek * 7700m / 7m
            * (goalType == GoalType.LoseWeight ? -1m : goalType == GoalType.GainWeight ? 1m : 0m);
        var minimumCalories = profile.Gender == Gender.Male ? 1500m : 1200m;
        var calories = Math.Round(Math.Max(minimumCalories, basalMetabolicRate * multiplier + dailyAdjustment), 2);

        return new UserGoal
        {
            UserId = userId,
            GoalType = goalType,
            TargetWeight = targetWeight,
            WeightChangePerWeek = weightChangePerWeek,
            TargetDailyCalories = calories,
            TargetProtein = Math.Round(calories * 0.30m / 4m, 2),
            TargetCarbohydrates = Math.Round(calories * 0.40m / 4m, 2),
            TargetFat = Math.Round(calories * 0.30m / 9m, 2),
            CreatedAt = now
        };
    }
}
