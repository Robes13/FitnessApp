using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Achievements;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.FoodLogs;

public sealed class FoodLogService(
    FitnessAppDbContext context,
    IAchievementService achievementService,
    TimeProvider timeProvider,
    ILogger<FoodLogService> logger) : IFoodLogService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IAchievementService _achievementService = achievementService;
    private readonly TimeProvider _timeProvider = timeProvider;
    private readonly ILogger<FoodLogService> _logger = logger;

    public async Task<FoodLogDto> GetAsync(int userId, int foodLogId, CancellationToken cancellationToken)
    {
        var log = await _context.FoodLogs
            .AsNoTracking()
            .Include(log => log.Food)
            .SingleOrDefaultAsync(
                log => log.FoodLogId == foodLogId && log.UserId == userId && !log.IsDeleted,
                cancellationToken)
            ?? throw new NotFoundException("Food log not found.");

        return ToDto(log);
    }

    public async Task<CursorPage<FoodLogDto>> GetHistoryAsync(
        int userId,
        DateTime? from,
        DateTime? to,
        int limit,
        string? cursor,
        CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit);
        var query = _context.FoodLogs
            .AsNoTracking()
            .Include(log => log.Food)
            .Where(log => log.UserId == userId && !log.IsDeleted);

        if (from.HasValue && to.HasValue)
        {
            RequestGuards.EnsureRange(RequestGuards.NormalizeUtc(from.Value), RequestGuards.NormalizeUtc(to.Value));
        }

        if (from.HasValue)
        {
            var normalizedFrom = RequestGuards.NormalizeUtc(from.Value);
            query = query.Where(log => log.ConsumedAt >= normalizedFrom);
        }

        if (to.HasValue)
        {
            var normalizedTo = RequestGuards.NormalizeUtc(to.Value);
            query = query.Where(log => log.ConsumedAt < normalizedTo);
        }

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecode(cursor, out var cursorTime, out var cursorId))
            {
                throw new BusinessValidationException("The cursor is invalid.");
            }

            query = query.Where(log => log.ConsumedAt < cursorTime
                || (log.ConsumedAt == cursorTime && log.FoodLogId < cursorId));
        }

        var logs = await query
            .OrderByDescending(log => log.ConsumedAt)
            .ThenByDescending(log => log.FoodLogId)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var hasMore = logs.Count > limit;
        if (hasMore)
        {
            logs.RemoveAt(logs.Count - 1);
        }

        var nextCursor = hasMore && logs.Count > 0
            ? CursorCodec.Encode(logs[^1].ConsumedAt, logs[^1].FoodLogId)
            : null;

        return new CursorPage<FoodLogDto>(logs.Select(ToDto).ToList(), nextCursor, hasMore);
    }

    public async Task<FoodLogDto> CreateAsync(
        int userId,
        CreateFoodLogRequest request,
        CancellationToken cancellationToken)
    {
        var log = await BuildLogAsync(userId, request, cancellationToken);
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.FoodLogs.Add(log);
        await _context.SaveChangesAsync(cancellationToken);
        await _achievementService.UpdateFoodProgressAsync(userId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await _context.Entry(log).Reference(candidate => candidate.Food).LoadAsync(cancellationToken);

        _logger.LogInformation("Food log {FoodLogId} was created for user {UserId}", log.FoodLogId, userId);
        return ToDto(log);
    }

    public async Task<IReadOnlyList<FoodLogDto>> CreateManyAsync(
        int userId,
        IReadOnlyList<CreateFoodLogRequest> requests,
        CancellationToken cancellationToken)
    {
        if (requests.Count == 0)
        {
            return Array.Empty<FoodLogDto>();
        }

        var logs = new List<FoodLog>(requests.Count);
        foreach (var request in requests)
        {
            logs.Add(await BuildLogAsync(userId, request, cancellationToken));
        }

        _context.FoodLogs.AddRange(logs);
        await _context.SaveChangesAsync(cancellationToken);
        await _achievementService.UpdateFoodProgressAsync(userId, cancellationToken);

        var foodIds = logs.Select(log => log.FoodId).Distinct().ToArray();
        var foodNames = await _context.Foods
            .AsNoTracking()
            .Where(food => foodIds.Contains(food.FoodId))
            .ToDictionaryAsync(food => food.FoodId, food => food.Name, cancellationToken);

        _logger.LogInformation("Created {FoodLogCount} food logs for user {UserId}", logs.Count, userId);
        return logs.Select(log => ToDto(log, foodNames[log.FoodId])).ToList();
    }

    public async Task<FoodLogDto> UpdateAsync(
        int userId,
        int foodLogId,
        UpdateFoodLogRequest request,
        CancellationToken cancellationToken)
    {
        var log = await _context.FoodLogs
            .SingleOrDefaultAsync(
                log => log.FoodLogId == foodLogId && log.UserId == userId && !log.IsDeleted,
                cancellationToken)
            ?? throw new NotFoundException("Food log not found.");

        var foodId = request.FoodId ?? log.FoodId;
        var quantity = request.Quantity ?? log.Quantity;
        var unit = request.Unit ?? log.Unit;
        var consumedAt = request.ConsumedAt.HasValue
            ? RequestGuards.NormalizeUtc(request.ConsumedAt.Value)
            : log.ConsumedAt;

        RequestGuards.EnsurePositive(quantity, nameof(request.Quantity));
        if (!Enum.IsDefined(unit))
        {
            throw new BusinessValidationException("Quantity unit is invalid.");
        }

        var food = await _context.Foods
            .Include(food => food.Servings)
            .SingleOrDefaultAsync(food => food.FoodId == foodId && (food.CreatedByUserId == userId || food.CreatedByUserId == null), cancellationToken)
            ?? throw new NotFoundException("Food not found.");

        ApplyNutrition(log, food, quantity, unit, consumedAt);

        await _context.SaveChangesAsync(cancellationToken);
        log.Food = food;
        return ToDto(log);
    }

    public async Task DeleteAsync(int userId, int foodLogId, CancellationToken cancellationToken)
    {
        var log = await _context.FoodLogs
            .SingleOrDefaultAsync(
                log => log.FoodLogId == foodLogId && log.UserId == userId && !log.IsDeleted,
                cancellationToken)
            ?? throw new NotFoundException("Food log not found.");

        log.IsDeleted = true;
        log.DeletedAt = _timeProvider.GetUtcNow().UtcDateTime;
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        await _achievementService.UpdateFoodProgressAsync(userId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task RestoreAsync(int userId, int foodLogId, CancellationToken cancellationToken)
    {
        var log = await _context.FoodLogs
            .SingleOrDefaultAsync(
                log => log.FoodLogId == foodLogId && log.UserId == userId && log.IsDeleted,
                cancellationToken)
            ?? throw new NotFoundException("Deleted food log not found.");

        log.IsDeleted = false;
        log.DeletedAt = null;
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        await _achievementService.UpdateFoodProgressAsync(userId, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task<FoodLog> BuildLogAsync(
        int userId,
        CreateFoodLogRequest request,
        CancellationToken cancellationToken)
    {
        RequestGuards.EnsurePositive(request.Quantity, nameof(request.Quantity));
        if (!Enum.IsDefined(request.Unit))
        {
            throw new BusinessValidationException("Quantity unit is invalid.");
        }
        if (!Enum.IsDefined(request.MealType))
            throw new BusinessValidationException("Meal type is invalid.");

        var food = await _context.Foods
            .AsNoTracking()
            .Include(food => food.Servings)
            .SingleOrDefaultAsync(food => food.FoodId == request.FoodId && (food.CreatedByUserId == userId || food.CreatedByUserId == null), cancellationToken)
            ?? throw new NotFoundException("Food not found.");

        var consumedAt = RequestGuards.NormalizeUtc(request.ConsumedAt);
        var log = new FoodLog { UserId = userId, MealType = request.MealType };
        ApplyNutrition(log, food, request.Quantity, request.Unit, consumedAt);
        return log;
    }

    private static void ApplyNutrition(
        FoodLog log,
        Food food,
        decimal quantity,
        QuantityUnit unit,
        DateTime consumedAt)
    {
        var totals = FoodNutritionCalculator.Calculate(food, quantity, unit);
        log.FoodId = food.FoodId;
        log.Quantity = quantity;
        log.Unit = unit;
        log.CaloriesConsumed = totals.Calories;
        log.ProteinConsumed = totals.Protein;
        log.CarbohydratesConsumed = totals.Carbohydrates;
        log.FatConsumed = totals.Fat;
        log.ConsumedAt = consumedAt;
    }

    public static FoodLogDto ToDto(FoodLog log)
    {
        return ToDto(log, log.Food.Name);
    }

    private static FoodLogDto ToDto(FoodLog log, string foodName)
    {
        return new FoodLogDto(
            log.FoodLogId,
            log.FoodId,
            foodName,
            log.Quantity,
            log.Unit,
            log.CaloriesConsumed,
            log.ProteinConsumed,
            log.CarbohydratesConsumed,
            log.FatConsumed,
            log.ConsumedAt,
            log.MealType);
    }
}
