using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Nutrition;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Utilities;

namespace FitnessApp.Api.Services.FoodLogs;

public static class FoodNutritionCalculator
{
    public static NutritionTotalsDto Calculate(Food food, decimal quantity, QuantityUnit unit)
    {
        RequestGuards.EnsurePositive(quantity, nameof(quantity));
        if (!Enum.IsDefined(unit))
            throw new BusinessValidationException("Quantity unit is invalid.");

        var grams = unit == QuantityUnit.Gram
            ? quantity
            : quantity * (food.Servings.SingleOrDefault(serving => serving.Unit == unit.ToServingUnit())
                ?? throw new BusinessValidationException($"Food {food.FoodId} has no conversion for {unit}."))
                .GramsPerUnit;
        var factor = grams / 100m;
        decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
        return new NutritionTotalsDto(
            Round(food.CaloriesPer100 * factor),
            Round(food.ProteinPer100 * factor),
            Round(food.CarbohydratesPer100 * factor),
            Round(food.FatPer100 * factor));
    }
}
