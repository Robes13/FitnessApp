using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Utilities;

public static class ProfileValidation
{
    public static void Validate(UserProfile profile, DateTime now)
    {
        var today = DateOnly.FromDateTime(now);
        var age = today.Year - profile.BirthDate.Year;
        if (profile.BirthDate > today.AddYears(-age)) age--;
        if (age is < 13 or > 100)
            throw new BusinessValidationException("Age must be between 13 and 100 years.");
        if (profile.Height is < 100m or > 250m)
            throw new BusinessValidationException("Height must be between 100 and 250 cm.");
        if (profile.StartingWeight is < 25m or > 400m)
            throw new BusinessValidationException("Starting weight must be between 25 and 400 kg.");
        if (profile.DailySteps is < 0 or > 100000)
            throw new BusinessValidationException("Daily steps must be between 0 and 100000.");
        if (profile.TrainingDaysPerWeek is < 0 or > 7)
            throw new BusinessValidationException("Training days must be between 0 and 7.");
        if (profile.WorkoutDurationMinutes is < 0 or > 480)
            throw new BusinessValidationException("Workout duration must be between 0 and 480 minutes.");
        if (!Enum.IsDefined(profile.Gender) || !Enum.IsDefined(profile.TrainingIntensity))
            throw new BusinessValidationException("A profile enum value is invalid.");
        try
        {
            _ = TimeZoneInfo.FindSystemTimeZoneById(profile.TimeZoneId);
        }
        catch (Exception exception) when (exception is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException)
        {
            throw new BusinessValidationException("TimeZoneId is invalid.");
        }
    }
}
