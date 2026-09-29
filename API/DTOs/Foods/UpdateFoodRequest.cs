using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Foods;

public sealed record UpdateFoodRequest
{
    [MaxLength(150)]
    public string? Name { get; init; }

    [MaxLength(100)]
    public string? Barcode { get; init; }

    public decimal? CaloriesPer100 { get; init; }
    public decimal? ProteinPer100 { get; init; }
    public decimal? CarbohydratesPer100 { get; init; }
    public decimal? FatPer100 { get; init; }
}
