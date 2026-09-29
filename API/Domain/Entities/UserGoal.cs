using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class UserGoal
{
    public int UserGoalId { get; set; }
    public int UserId { get; set; }
    public GoalType GoalType { get; set; }
    public decimal TargetWeight { get; set; }
    public decimal WeightChangePerWeek { get; set; }
    public decimal TargetDailyCalories { get; set; }
    public decimal TargetProtein { get; set; }
    public decimal TargetCarbohydrates { get; set; }
    public decimal TargetFat { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
