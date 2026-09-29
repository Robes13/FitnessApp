using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class UserSetting
{
    public int UserSettingId { get; set; }
    public int UserId { get; set; }
    public SettingKey SettingKey { get; set; }
    public required string SettingValue { get; set; }
    public DateTime UpdatedAt { get; set; }

    public User User { get; set; } = null!;
}
