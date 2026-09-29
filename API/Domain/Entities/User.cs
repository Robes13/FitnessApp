namespace FitnessApp.Api.Domain.Entities;

public class User
{
    public int UserId { get; set; }
    public required string Email { get; set; }
    public required string Username { get; set; }
    public required string PasswordHash { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime? EmailVerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }

    public UserProfile? UserProfile { get; set; }
    public ICollection<UserGoal> UserGoals { get; set; } = new List<UserGoal>();
    public ICollection<FoodLog> FoodLogs { get; set; } = new List<FoodLog>();
    public ICollection<WeightLog> WeightLogs { get; set; } = new List<WeightLog>();
    public ICollection<MealCollection> MealCollections { get; set; } = new List<MealCollection>();
    public ICollection<Reminder> Reminders { get; set; } = new List<Reminder>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
    public ICollection<EmailVerificationToken> EmailVerificationTokens { get; set; } = new List<EmailVerificationToken>();
    public ICollection<UserConsent> UserConsents { get; set; } = new List<UserConsent>();
    public ICollection<UserDevice> UserDevices { get; set; } = new List<UserDevice>();
    public ICollection<Food> CreatedFoods { get; set; } = new List<Food>();
    public ICollection<UserAchievement> UserAchievements { get; set; } = new List<UserAchievement>();
    public ICollection<UserSetting> UserSettings { get; set; } = new List<UserSetting>();
    public ICollection<LogEntry> LogEntries { get; set; } = new List<LogEntry>();
}
