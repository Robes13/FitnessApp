using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class MealItem
{
    public int MealItemId { get; set; }
    public int MealCollectionId { get; set; }
    public int FoodId { get; set; }
    public decimal Quantity { get; set; }
    public QuantityUnit Unit { get; set; }

    public MealCollection MealCollection { get; set; } = null!;
    public Food Food { get; set; } = null!;
}
