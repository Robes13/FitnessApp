using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class FoodLog
{
    public int FoodLogId { get; set; }
    public int UserId { get; set; }
    public int FoodId { get; set; }
    public decimal Quantity { get; set; }
    public QuantityUnit Unit { get; set; }
    public decimal CaloriesConsumed { get; set; }
    public decimal ProteinConsumed { get; set; }
    public decimal CarbohydratesConsumed { get; set; }
    public decimal FatConsumed { get; set; }
    public DateTime ConsumedAt { get; set; }
    public MealType MealType { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public User User { get; set; } = null!;
    public Food Food { get; set; } = null!;
}
