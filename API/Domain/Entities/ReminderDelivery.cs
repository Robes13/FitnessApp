namespace FitnessApp.Api.Domain.Entities;

public class ReminderDelivery
{
    public long ReminderDeliveryId { get; set; }
    public int ReminderId { get; set; }
    public DateTime ScheduledFor { get; set; }
    public DateTime? SentAt { get; set; }
    public Guid ClaimId { get; set; }
    public DateTime ClaimedUntil { get; set; }
    public Reminder Reminder { get; set; } = null!;
}
