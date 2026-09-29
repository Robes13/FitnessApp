using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Meals;

public sealed record CreateMealCollectionRequest
{
    [Required, MaxLength(100)]
    public required string Name { get; init; }
    [Required]
    public required IReadOnlyList<CreateMealItemRequest> Items { get; init; }
}
