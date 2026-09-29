using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Foods;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Foods;

public sealed class FoodService(FitnessAppDbContext context, TimeProvider timeProvider) : IFoodService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<CursorPage<FoodDto>> SearchAsync(
        string? query,
        string? barcode,
        bool createdByMe,
        int userId,
        int limit,
        string? cursor,
        CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit, defaultValue: 30, maximum: 100);
        var foodsQuery = _context.Foods.AsNoTracking()
            .Where(food => food.CreatedByUserId == userId);

        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim();
            var pattern = $"%{term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            foodsQuery = foodsQuery.Where(food =>
                EF.Functions.ILike(food.Name, pattern, "\\"));
        }

        if (!string.IsNullOrWhiteSpace(barcode))
        {
            var normalizedBarcode = barcode.Trim();
            foodsQuery = foodsQuery.Where(food => food.Barcode == normalizedBarcode);
        }

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecodeId(cursor, out var cursorId))
            {
                throw new BusinessValidationException("The cursor is invalid.");
            }

            foodsQuery = foodsQuery.Where(food => food.FoodId < cursorId);
        }

        var foods = await foodsQuery
            .Include(food => food.Servings)
            .OrderByDescending(food => food.FoodId)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var hasMore = foods.Count > limit;
        if (hasMore)
        {
            foods.RemoveAt(foods.Count - 1);
        }

        var nextCursor = hasMore && foods.Count > 0
            ? CursorCodec.EncodeId(foods[^1].FoodId)
            : null;

        return new CursorPage<FoodDto>(foods.Select(ToDto).ToList(), nextCursor, hasMore);
    }

    public async Task<FoodDto> GetAsync(int userId, int foodId, CancellationToken cancellationToken)
    {
        var food = await _context.Foods
            .AsNoTracking()
            .Include(food => food.Servings)
            .SingleOrDefaultAsync(food => food.FoodId == foodId && food.CreatedByUserId == userId, cancellationToken)
            ?? throw new NotFoundException("Food not found.");

        return ToDto(food);
    }

    public async Task<FoodDto> CreateAsync(int userId, CreateFoodRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 150)
            throw new BusinessValidationException("Food name must contain 1–150 characters.");
        ValidateNutrition(request.CaloriesPer100, request.ProteinPer100, request.CarbohydratesPer100, request.FatPer100);
        var normalizedName = request.Name.Trim();
        if (await _context.Foods.AnyAsync(food => food.CreatedByUserId == userId
            && food.Name.ToLower() == normalizedName.ToLower(), cancellationToken))
            throw new ConflictException("A food with that name already exists in your catalogue.");

        var food = new Food
        {
            Name = normalizedName,
            Barcode = NormalizeBarcode(request.Barcode),
            CaloriesPer100 = request.CaloriesPer100,
            ProteinPer100 = request.ProteinPer100,
            CarbohydratesPer100 = request.CarbohydratesPer100,
            FatPer100 = request.FatPer100,
            CreatedByUserId = userId,
            CreatedAt = _timeProvider.GetUtcNow().UtcDateTime
        };

        _context.Foods.Add(food);
        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(food);
    }

    public async Task<FoodDto> UpdateAsync(
        int userId,
        int foodId,
        UpdateFoodRequest request,
        CancellationToken cancellationToken)
    {
        var food = await GetOwnedFoodAsync(userId, foodId, cancellationToken);

        if (request.Name is not null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new BusinessValidationException("Name cannot be empty.");
            }

            food.Name = request.Name.Trim();
            if (food.Name.Length > 150)
                throw new BusinessValidationException("Food name must contain at most 150 characters.");
            if (await _context.Foods.AnyAsync(candidate => candidate.CreatedByUserId == userId
                && candidate.FoodId != foodId && candidate.Name.ToLower() == food.Name.ToLower(),
                cancellationToken))
                throw new ConflictException("A food with that name already exists in your catalogue.");
        }

        if (request.Barcode is not null)
        {
            food.Barcode = NormalizeBarcode(request.Barcode);
        }

        if (request.CaloriesPer100.HasValue) food.CaloriesPer100 = request.CaloriesPer100.Value;
        if (request.ProteinPer100.HasValue) food.ProteinPer100 = request.ProteinPer100.Value;
        if (request.CarbohydratesPer100.HasValue) food.CarbohydratesPer100 = request.CarbohydratesPer100.Value;
        if (request.FatPer100.HasValue) food.FatPer100 = request.FatPer100.Value;

        ValidateNutrition(food.CaloriesPer100, food.ProteinPer100, food.CarbohydratesPer100, food.FatPer100);
        await _context.SaveChangesAsync(cancellationToken);

        await _context.Entry(food).Collection(candidate => candidate.Servings).LoadAsync(cancellationToken);
        return ToDto(food);
    }

    public async Task DeleteAsync(int userId, int foodId, CancellationToken cancellationToken)
    {
        var food = await GetOwnedFoodAsync(userId, foodId, cancellationToken);
        var isReferenced = await _context.FoodLogs.AnyAsync(log => log.FoodId == foodId, cancellationToken)
            || await _context.MealItems.AnyAsync(item => item.FoodId == foodId, cancellationToken);

        if (isReferenced)
        {
            throw new ConflictException("This food is referenced by history or a saved meal and cannot be physically deleted.");
        }

        _context.Foods.Remove(food);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<FoodServingDto> UpsertServingAsync(
        int userId,
        int foodId,
        UpsertFoodServingRequest request,
        CancellationToken cancellationToken)
    {
        _ = await GetOwnedFoodAsync(userId, foodId, cancellationToken);

        if (!Enum.IsDefined(request.Unit))
        {
            throw new BusinessValidationException("Serving unit is invalid.");
        }

        RequestGuards.EnsurePositive(request.GramsPerUnit, nameof(request.GramsPerUnit));

        var serving = await _context.FoodServings
            .SingleOrDefaultAsync(
                serving => serving.FoodId == foodId && serving.Unit == request.Unit,
                cancellationToken);

        if (serving is null)
        {
            serving = new FoodServing
            {
                FoodId = foodId,
                Unit = request.Unit,
                GramsPerUnit = request.GramsPerUnit
            };
            _context.FoodServings.Add(serving);
        }
        else
        {
            serving.GramsPerUnit = request.GramsPerUnit;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return new FoodServingDto(serving.FoodServingId, serving.Unit, serving.GramsPerUnit);
    }

    public async Task DeleteServingAsync(
        int userId,
        int foodId,
        ServingUnit unit,
        CancellationToken cancellationToken)
    {
        _ = await GetOwnedFoodAsync(userId, foodId, cancellationToken);
        var serving = await _context.FoodServings
            .SingleOrDefaultAsync(
                serving => serving.FoodId == foodId && serving.Unit == unit,
                cancellationToken)
            ?? throw new NotFoundException("Food serving not found.");

        _context.FoodServings.Remove(serving);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<Food> GetOwnedFoodAsync(int userId, int foodId, CancellationToken cancellationToken)
    {
        var food = await _context.Foods
            .SingleOrDefaultAsync(food => food.FoodId == foodId, cancellationToken)
            ?? throw new NotFoundException("Food not found.");

        if (food.CreatedByUserId != userId)
        {
            throw new UnauthorizedAccessException("Only the creator can modify this food.");
        }

        return food;
    }

    private static void ValidateNutrition(decimal calories, decimal protein, decimal carbohydrates, decimal fat)
    {
        RequestGuards.EnsureNonNegative(calories, "CaloriesPer100");
        RequestGuards.EnsureNonNegative(protein, "ProteinPer100");
        RequestGuards.EnsureNonNegative(carbohydrates, "CarbohydratesPer100");
        RequestGuards.EnsureNonNegative(fat, "FatPer100");
    }

    private static string? NormalizeBarcode(string? barcode)
    {
        return string.IsNullOrWhiteSpace(barcode) ? null : barcode.Trim();
    }

    public static FoodDto ToDto(Food food)
    {
        return new FoodDto(
            food.FoodId,
            food.Name,
            food.Barcode,
            food.CaloriesPer100,
            food.ProteinPer100,
            food.CarbohydratesPer100,
            food.FatPer100,
            food.CreatedByUserId,
            food.CreatedAt,
            food.Servings
                .OrderBy(serving => serving.Unit)
                .Select(serving => new FoodServingDto(serving.FoodServingId, serving.Unit, serving.GramsPerUnit))
                .ToList());
    }
}
