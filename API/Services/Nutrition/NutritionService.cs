using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Nutrition;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.FoodLogs;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Nutrition;

public sealed class NutritionService(FitnessAppDbContext context, TimeProvider timeProvider) : INutritionService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<NutritionDayDto> GetTodayAsync(int userId, CancellationToken cancellationToken)
    {
        var zone = await GetTimeZoneAsync(userId, cancellationToken);
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(
            _timeProvider.GetUtcNow().UtcDateTime, zone));
        return (await GetDaysAsync(userId, today, today.AddDays(1), cancellationToken))[0];
    }

    public async Task<IReadOnlyList<NutritionDayDto>> GetDaysAsync(
        int userId, DateOnly from, DateOnly to, CancellationToken cancellationToken)
    {
        var days = to.DayNumber - from.DayNumber;
        if (days is < 1 or > 32)
            throw new BusinessValidationException("Day ranges must contain 1–32 days; 'to' is exclusive.");

        var zone = await GetTimeZoneAsync(userId, cancellationToken);
        DateTime AtStart(DateOnly day) => TimeZoneInfo.ConvertTimeToUtc(
            day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), zone);
        var utcFrom = AtStart(from);
        var utcTo = AtStart(to);
        var logs = await _context.FoodLogs.AsNoTracking()
            .Where(log => log.UserId == userId && !log.IsDeleted
                && log.ConsumedAt >= utcFrom && log.ConsumedAt < utcTo)
            .Select(log => new
            {
                log.ConsumedAt, log.CaloriesConsumed, log.ProteinConsumed,
                log.CarbohydratesConsumed, log.FatConsumed
            }).ToListAsync(cancellationToken);
        var totals = logs.GroupBy(log => DateOnly.FromDateTime(
            TimeZoneInfo.ConvertTimeFromUtc(log.ConsumedAt, zone)))
            .ToDictionary(group => group.Key, group => new NutritionTotalsDto(
                group.Sum(log => log.CaloriesConsumed),
                group.Sum(log => log.ProteinConsumed),
                group.Sum(log => log.CarbohydratesConsumed),
                group.Sum(log => log.FatConsumed)));

        var baseline = await _context.UserGoals.AsNoTracking()
            .Where(goal => goal.UserId == userId && goal.CreatedAt < utcFrom)
            .OrderByDescending(goal => goal.CreatedAt).ThenByDescending(goal => goal.UserGoalId)
            .FirstOrDefaultAsync(cancellationToken);
        var goals = await _context.UserGoals.AsNoTracking()
            .Where(goal => goal.UserId == userId && goal.CreatedAt >= utcFrom && goal.CreatedAt < utcTo)
            .OrderBy(goal => goal.CreatedAt).ThenBy(goal => goal.UserGoalId)
            .ToListAsync(cancellationToken);
        if (baseline is not null) goals.Insert(0, baseline);

        var result = new List<NutritionDayDto>(days);
        for (var day = from; day < to; day = day.AddDays(1))
        {
            var dayEnd = AtStart(day.AddDays(1));
            var goal = goals.LastOrDefault(candidate => candidate.CreatedAt < dayEnd);
            var consumed = totals.GetValueOrDefault(day)
                ?? new NutritionTotalsDto(0m, 0m, 0m, 0m);
            var remaining = goal is null ? null : new NutritionTotalsDto(
                goal.TargetDailyCalories - consumed.Calories,
                goal.TargetProtein - consumed.Protein,
                goal.TargetCarbohydrates - consumed.Carbohydrates,
                goal.TargetFat - consumed.Fat);
            result.Add(new NutritionDayDto(day, consumed,
                goal is null ? null : UserGoalService.ToDto(goal), remaining));
        }
        return result;
    }

    private async Task<TimeZoneInfo> GetTimeZoneAsync(int userId, CancellationToken cancellationToken)
    {
        var id = await _context.UserProfiles.AsNoTracking()
            .Where(profile => profile.UserId == userId)
            .Select(profile => profile.TimeZoneId).SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Profile not found.");
        return TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    public async Task<CursorPage<NutritionHistoryItemDto>> GetHistoryAsync(
        int userId,
        DateTime from,
        DateTime to,
        int limit,
        string? cursor,
        CancellationToken cancellationToken)
    {
        from = RequestGuards.NormalizeUtc(from);
        to = RequestGuards.NormalizeUtc(to);
        RequestGuards.EnsureRange(from, to);
        limit = RequestGuards.NormalizeLimit(limit);

        var query = _context.FoodLogs
            .AsNoTracking()
            .Include(log => log.Food)
            .Where(log =>
                log.UserId == userId
                && !log.IsDeleted
                && log.ConsumedAt >= from
                && log.ConsumedAt < to);

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecode(cursor, out var cursorTime, out var cursorId))
            {
                throw new BusinessValidationException("The cursor is invalid.");
            }

            query = query.Where(log =>
                log.ConsumedAt < cursorTime
                || (log.ConsumedAt == cursorTime && log.FoodLogId < cursorId));
        }

        var rows = await query
            .OrderByDescending(log => log.ConsumedAt)
            .ThenByDescending(log => log.FoodLogId)
            .Select(log => new
            {
                Log = log,
                GoalId = _context.UserGoals.Where(goal => goal.UserId == log.UserId
                        && goal.CreatedAt <= log.ConsumedAt)
                    .OrderByDescending(goal => goal.CreatedAt)
                    .ThenByDescending(goal => goal.UserGoalId)
                    .Select(goal => (int?)goal.UserGoalId)
                    .FirstOrDefault()
            })
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var hasMore = rows.Count > limit;
        if (hasMore)
        {
            rows.RemoveAt(rows.Count - 1);
        }

        if (rows.Count == 0)
        {
            return new CursorPage<NutritionHistoryItemDto>(Array.Empty<NutritionHistoryItemDto>(), null, false);
        }

        var goalIds = rows.Where(row => row.GoalId.HasValue)
            .Select(row => row.GoalId!.Value).Distinct().ToArray();
        var goalById = await _context.UserGoals.AsNoTracking()
            .Where(goal => goalIds.Contains(goal.UserGoalId))
            .ToDictionaryAsync(goal => goal.UserGoalId, cancellationToken);
        var items = rows.Select(row => new NutritionHistoryItemDto(
            FoodLogService.ToDto(row.Log),
            row.GoalId.HasValue ? UserGoalService.ToDto(goalById[row.GoalId.Value]) : null)).ToList();

        var nextCursor = hasMore
            ? CursorCodec.Encode(rows[^1].Log.ConsumedAt, rows[^1].Log.FoodLogId)
            : null;

        return new CursorPage<NutritionHistoryItemDto>(items, nextCursor, hasMore);
    }

}
