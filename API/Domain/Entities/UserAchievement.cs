using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class UserAchievement
{
    public int UserAchievementId { get; set; }
    public int UserId { get; set; }
    public AchievementType AchievementType { get; set; }
    public int Progress { get; set; }
    public DateTime? CompletedAt { get; set; }

    public User User { get; set; } = null!;
}
