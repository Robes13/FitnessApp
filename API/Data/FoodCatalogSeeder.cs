using System.Text.Json;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Data;

/// <summary>
/// Seeds the shared food catalogue (FOOD rows without an owner) from <c>Data/food-catalog.json</c>:
/// products sold in Denmark from Open Food Facts (ODbL, https://world.openfoodfacts.org), with
/// barcode and nutrition per 100 g. Only barcodes the catalogue lacks are added, so it is safe on
/// every start.
/// </summary>
public static class FoodCatalogSeeder
{
    private sealed record CatalogFood(
        string Barcode, string Name, decimal Kcal, decimal Protein, decimal Carbs, decimal Fat, bool Liquid);

    public static int Seed(FitnessAppDbContext context, string contentRootPath, DateTime now)
    {
        var json = File.ReadAllText(Path.Combine(contentRootPath, "Data", "food-catalog.json"));
        var catalogue = JsonSerializer.Deserialize<CatalogFood[]>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))
            ?? [];
        var existing = context.Foods
            .Where(food => food.CreatedByUserId == null && food.Barcode != null)
            .Select(food => food.Barcode!)
            .ToHashSet();

        var added = catalogue.Where(item => existing.Add(item.Barcode)).Select(item => new Food
        {
            Name = item.Name,
            Barcode = item.Barcode,
            CaloriesPer100 = item.Kcal,
            ProteinPer100 = item.Protein,
            CarbohydratesPer100 = item.Carbs,
            FatPer100 = item.Fat,
            CreatedAt = now,
            // A liquid is logged in ml; its values are per 100 ml, so 1 ml counts as 1 g.
            Servings = item.Liquid ? [new FoodServing { Unit = ServingUnit.Milliliter, GramsPerUnit = 1 }] : []
        }).ToList();

        context.Foods.AddRange(added);
        context.SaveChanges();
        return added.Count;
    }
}
