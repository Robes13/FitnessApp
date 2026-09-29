using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class Reminder
{
    public int ReminderId { get; set; }
    public int UserId { get; set; }
    public ReminderType ReminderType { get; set; }
    public TimeOnly ReminderTime { get; set; }
    public bool IsEnabled { get; set; }

    public User User { get; set; } = null!;
    public ICollection<ReminderDelivery> Deliveries { get; set; } = new List<ReminderDelivery>();
}
