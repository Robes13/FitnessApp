using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class UserProfile
{
    public int UserProfileId { get; set; }
    public int UserId { get; set; }
    public DateOnly BirthDate { get; set; }
    public Gender Gender { get; set; }
    public decimal Height { get; set; }
    public decimal StartingWeight { get; set; }
    public string TimeZoneId { get; set; } = "UTC";
    public string? ProfileImagePath { get; set; }
    public int DailySteps { get; set; }
    public int TrainingDaysPerWeek { get; set; }
    public int WorkoutDurationMinutes { get; set; }
    public TrainingIntensity TrainingIntensity { get; set; }

    public User User { get; set; } = null!;
}
