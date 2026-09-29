using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class FoodServing
{
    public int FoodServingId { get; set; }
    public int FoodId { get; set; }
    public ServingUnit Unit { get; set; }
    public decimal GramsPerUnit { get; set; }

    public Food Food { get; set; } = null!;
}
