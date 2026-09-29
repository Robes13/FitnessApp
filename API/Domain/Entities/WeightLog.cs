namespace FitnessApp.Api.Domain.Entities;

public class WeightLog
{
    public int WeightLogId { get; set; }
    public int UserId { get; set; }
    public decimal Weight { get; set; }
    public DateTime RecordedAt { get; set; }
    public DateOnly RecordedDate { get; set; }

    public User User { get; set; } = null!;
}
