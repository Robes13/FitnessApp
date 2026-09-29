namespace FitnessApp.Api.Domain.Entities;

public class MealCollection
{
    public int MealCollectionId { get; set; }
    public int UserId { get; set; }
    public required string Name { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
    public ICollection<MealItem> Items { get; set; } = new List<MealItem>();
}
