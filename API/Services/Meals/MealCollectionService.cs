using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Meals;
using FitnessApp.Api.DTOs.Nutrition;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.FoodLogs;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Meals;

public sealed class MealCollectionService(
    FitnessAppDbContext context,
    IFoodLogService foodLogService,
    TimeProvider timeProvider) : IMealCollectionService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IFoodLogService _foodLogService = foodLogService;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<CursorPage<MealCollectionDto>> GetAllAsync(
        int userId, int limit, string? cursor, CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit, defaultValue: 30, maximum: 100);
        var query = _context.MealCollections
            .AsNoTracking()
            .Include(collection => collection.Items)
                .ThenInclude(item => item.Food)
                    .ThenInclude(food => food.Servings)
            .Where(collection => collection.UserId == userId);

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecode(cursor, out var cursorTime, out var cursorId))
            {
                throw new BusinessValidationException("The cursor is invalid.");
            }

            query = query.Where(collection => collection.CreatedAt < cursorTime
                || (collection.CreatedAt == cursorTime && collection.MealCollectionId < cursorId));
        }

        var collections = await query
            .AsSplitQuery()
            .OrderByDescending(collection => collection.CreatedAt)
            .ThenByDescending(collection => collection.MealCollectionId)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var hasMore = collections.Count > limit;
        if (hasMore) collections.RemoveAt(collections.Count - 1);

        var nextCursor = hasMore && collections.Count > 0
            ? CursorCodec.Encode(collections[^1].CreatedAt, collections[^1].MealCollectionId)
            : null;

        return new CursorPage<MealCollectionDto>(collections.Select(ToDto).ToList(), nextCursor, hasMore);
    }

    public async Task<MealCollectionDto> GetAsync(int userId, int collectionId, CancellationToken cancellationToken)
    {
        var collection = await GetOwnedCollectionQuery(userId, collectionId)
            .AsNoTracking()
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.Food)
                    .ThenInclude(food => food.Servings)
            .AsSplitQuery()
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Meal collection not found.");

        return ToDto(collection);
    }

    public async Task<MealCollectionDto> CreateAsync(
        int userId, CreateMealCollectionRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessValidationException("Name is required.");
        }
        if (request.Items is null || request.Items.Count is < 1 or > 50)
            throw new BusinessValidationException("A meal collection must contain 1–50 items.");

        var foodIds = request.Items.Select(item => item.FoodId).Distinct().ToArray();
        var foods = await _context.Foods.Include(food => food.Servings)
            .Where(food => food.CreatedByUserId == userId && foodIds.Contains(food.FoodId))
            .ToDictionaryAsync(food => food.FoodId, cancellationToken);
        if (foods.Count != foodIds.Length)
            throw new NotFoundException("One or more foods were not found.");

        var collection = new MealCollection
        {
            UserId = userId,
            Name = request.Name.Trim(),
            CreatedAt = _timeProvider.GetUtcNow().UtcDateTime
        };
        foreach (var requestItem in request.Items)
        {
            ValidateItem(requestItem.FoodId, requestItem.Quantity, requestItem.Unit);
            var food = foods[requestItem.FoodId];
            _ = FoodNutritionCalculator.Calculate(food, requestItem.Quantity, requestItem.Unit);
            collection.Items.Add(new MealItem
            {
                Food = food,
                Quantity = requestItem.Quantity,
                Unit = requestItem.Unit
            });
        }

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.MealCollections.Add(collection);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToDto(collection);
    }

    public async Task<MealCollectionDto> UpdateAsync(
        int userId, int collectionId, UpdateMealCollectionRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new BusinessValidationException("Name is required.");
        }

        var collection = await GetOwnedCollectionQuery(userId, collectionId)
            .Include(candidate => candidate.Items)
                .ThenInclude(item => item.Food)
                    .ThenInclude(food => food.Servings)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Meal collection not found.");

        collection.Name = request.Name.Trim();
        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(collection);
    }

    public async Task DeleteAsync(int userId, int collectionId, CancellationToken cancellationToken)
    {
        var collection = await GetOwnedCollectionQuery(userId, collectionId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Meal collection not found.");

        _context.MealCollections.Remove(collection);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<MealItemDto> AddItemAsync(
        int userId, int collectionId, CreateMealItemRequest request, CancellationToken cancellationToken)
    {
        _ = await GetOwnedCollectionQuery(userId, collectionId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Meal collection not found.");

        ValidateItem(request.FoodId, request.Quantity, request.Unit);
        var food = await _context.Foods.AsNoTracking().Include(candidate => candidate.Servings)
            .SingleOrDefaultAsync(food => food.FoodId == request.FoodId && food.CreatedByUserId == userId, cancellationToken)
            ?? throw new NotFoundException("Food not found.");
        _ = FoodNutritionCalculator.Calculate(food, request.Quantity, request.Unit);

        var item = new MealItem
        {
            MealCollectionId = collectionId,
            FoodId = request.FoodId,
            Quantity = request.Quantity,
            Unit = request.Unit
        };

        _context.MealItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);
        return new MealItemDto(item.MealItemId, item.FoodId, food.Name, item.Quantity, item.Unit);
    }

    public async Task<MealItemDto> UpdateItemAsync(
        int userId, int collectionId, int itemId, UpdateMealItemRequest request, CancellationToken cancellationToken)
    {
        var item = await _context.MealItems
            .Include(item => item.MealCollection)
            .SingleOrDefaultAsync(
                item => item.MealItemId == itemId
                    && item.MealCollectionId == collectionId
                    && item.MealCollection.UserId == userId,
                cancellationToken)
            ?? throw new NotFoundException("Meal item not found.");

        var foodId = request.FoodId ?? item.FoodId;
        var quantity = request.Quantity ?? item.Quantity;
        var unit = request.Unit ?? item.Unit;
        ValidateItem(foodId, quantity, unit);

        var food = await _context.Foods.AsNoTracking().Include(candidate => candidate.Servings)
            .SingleOrDefaultAsync(food => food.FoodId == foodId && food.CreatedByUserId == userId, cancellationToken)
            ?? throw new NotFoundException("Food not found.");
        _ = FoodNutritionCalculator.Calculate(food, quantity, unit);

        item.FoodId = foodId;
        item.Quantity = quantity;
        item.Unit = unit;
        await _context.SaveChangesAsync(cancellationToken);

        return new MealItemDto(item.MealItemId, item.FoodId, food.Name, item.Quantity, item.Unit);
    }

    public async Task DeleteItemAsync(
        int userId, int collectionId, int itemId, CancellationToken cancellationToken)
    {
        var item = await _context.MealItems
            .Include(item => item.MealCollection)
            .SingleOrDefaultAsync(
                item => item.MealItemId == itemId
                    && item.MealCollectionId == collectionId
                    && item.MealCollection.UserId == userId,
                cancellationToken)
            ?? throw new NotFoundException("Meal item not found.");

        var itemCount = await _context.MealItems.CountAsync(
            candidate => candidate.MealCollectionId == collectionId, cancellationToken);
        if (itemCount <= 1)
            throw new BusinessValidationException("A meal collection must contain at least one item.");

        _context.MealItems.Remove(item);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FoodLogDto>> LogAsync(
        int userId, int collectionId, LogMealCollectionRequest request, CancellationToken cancellationToken)
    {
        RequestGuards.EnsurePositive(request.Multiplier, nameof(request.Multiplier));

        var collection = await GetOwnedCollectionQuery(userId, collectionId)
            .AsNoTracking()
            .Include(candidate => candidate.Items)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Meal collection not found.");

        if (collection.Items.Count == 0)
        {
            throw new BusinessValidationException("The meal collection has no items to log.");
        }

        var requests = collection.Items
            .Select(item => new CreateFoodLogRequest(
                item.FoodId,
                item.Quantity * request.Multiplier,
                item.Unit,
                request.ConsumedAt,
                request.MealType))
            .ToList();

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        var logs = await _foodLogService.CreateManyAsync(userId, requests, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return logs;
    }

    private IQueryable<MealCollection> GetOwnedCollectionQuery(int userId, int collectionId)
    {
        return _context.MealCollections.Where(collection =>
            collection.MealCollectionId == collectionId && collection.UserId == userId);
    }

    private static void ValidateItem(int foodId, decimal quantity, FitnessApp.Api.Domain.Enums.QuantityUnit unit)
    {
        if (foodId <= 0)
        {
            throw new BusinessValidationException("FoodId must be greater than zero.");
        }

        RequestGuards.EnsurePositive(quantity, nameof(quantity));
        if (!Enum.IsDefined(unit))
        {
            throw new BusinessValidationException("Quantity unit is invalid.");
        }
    }

    public static MealCollectionDto ToDto(MealCollection collection)
    {
        var items = collection.Items
            .OrderBy(item => item.MealItemId)
            .Select(item => new MealItemDto(
                item.MealItemId,
                item.FoodId,
                item.Food.Name,
                item.Quantity,
                item.Unit))
            .ToList();

        var nutrition = collection.Items.Select(item => FoodNutritionCalculator.Calculate(
            item.Food, item.Quantity, item.Unit)).ToList();
        var totals = new NutritionTotalsDto(
            nutrition.Sum(value => value.Calories),
            nutrition.Sum(value => value.Protein),
            nutrition.Sum(value => value.Carbohydrates),
            nutrition.Sum(value => value.Fat));
        return new MealCollectionDto(collection.MealCollectionId, collection.Name, collection.CreatedAt, items, totals);
    }
}
