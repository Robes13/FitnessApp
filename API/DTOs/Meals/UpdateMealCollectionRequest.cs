using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record UpdateMealCollectionRequest
{
    [Required, MaxLength(100)]
    public required string Name { get; init; }
}
