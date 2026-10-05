namespace FitnessApp.Api.Domain.Entities;

public class Food
{
    public int FoodId { get; set; }
    public required string Name { get; set; }
    public string? Barcode { get; set; }
    public decimal CaloriesPer100 { get; set; }
    public decimal ProteinPer100 { get; set; }
    public decimal CarbohydratesPer100 { get; set; }
    public decimal FatPer100 { get; set; }
    /// <summary>The owner, or <c>null</c> for the shared, read-only catalogue (Open Food Facts).</summary>
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User? CreatedByUser { get; set; }
    public ICollection<FoodServing> Servings { get; set; } = new List<FoodServing>();
    public ICollection<FoodLog> FoodLogs { get; set; } = new List<FoodLog>();
    public ICollection<MealItem> MealItems { get; set; } = new List<MealItem>();
}
