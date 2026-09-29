using System.Globalization;
using System.Text;
using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.History;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.History;

public sealed class HistoryService(FitnessAppDbContext context) : IHistoryService
{
    private readonly FitnessAppDbContext _context = context;

    public async Task<CursorPage<HistoryEventDto>> GetAsync(
        int userId, DateTime? from, DateTime? to, string? types,
        int limit, string? cursor, CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit);
        if (from.HasValue && to.HasValue)
            RequestGuards.EnsureRange(RequestGuards.NormalizeUtc(from.Value), RequestGuards.NormalizeUtc(to.Value));

        var selected = ParseTypes(types);
        var account = _context.Users.AsNoTracking().Where(user => user.UserId == userId)
            .Select(user => new { OccurredAt = user.CreatedAt, Type = (int)HistoryEventType.AccountCreated, Id = user.UserId });
        var goals = _context.UserGoals.AsNoTracking().Where(goal => goal.UserId == userId)
            .Select(goal => new { OccurredAt = goal.CreatedAt, Type = (int)HistoryEventType.GoalUpdated, Id = goal.UserGoalId });
        var foods = _context.FoodLogs.AsNoTracking().Where(log => log.UserId == userId && !log.IsDeleted)
            .Select(log => new { OccurredAt = log.ConsumedAt, Type = (int)HistoryEventType.FoodLogged, Id = log.FoodLogId });
        var weights = _context.WeightLogs.AsNoTracking().Where(log => log.UserId == userId)
            .Select(log => new { OccurredAt = log.RecordedAt, Type = (int)HistoryEventType.WeightRecorded, Id = log.WeightLogId });
        var achievements = _context.UserAchievements.AsNoTracking()
            .Where(item => item.UserId == userId && item.CompletedAt != null)
            .Select(item => new { OccurredAt = item.CompletedAt!.Value,
                Type = (int)HistoryEventType.AchievementCompleted, Id = item.UserAchievementId });
        var query = account.Concat(goals).Concat(foods).Concat(weights).Concat(achievements);
        if (selected is not null)
            query = query.Where(row => selected.Contains(row.Type));
        if (from.HasValue)
        {
            var lower = RequestGuards.NormalizeUtc(from.Value);
            query = query.Where(row => row.OccurredAt >= lower);
        }
        if (to.HasValue)
        {
            var upper = RequestGuards.NormalizeUtc(to.Value);
            query = query.Where(row => row.OccurredAt < upper);
        }

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!TryDecode(cursor, out var time, out var type, out var id))
                throw new BusinessValidationException("The history cursor is invalid.");
            query = query.Where(row => row.OccurredAt < time
                || row.OccurredAt == time && row.Type < type
                || row.OccurredAt == time && row.Type == type && row.Id < id);
        }

        var rows = await query.OrderByDescending(row => row.OccurredAt)
            .ThenByDescending(row => row.Type).ThenByDescending(row => row.Id)
            .Take(limit + 1).ToListAsync(cancellationToken);
        var hasMore = rows.Count > limit;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        var last = rows.LastOrDefault();
        var nextCursor = hasMore && last is not null
            ? Encode(last.OccurredAt, last.Type, last.Id) : null;
        return new CursorPage<HistoryEventDto>(rows.Select(row =>
            new HistoryEventDto((HistoryEventType)row.Type, row.OccurredAt, row.Id)).ToList(),
            nextCursor, hasMore);
    }

    private static int[]? ParseTypes(string? types)
    {
        if (string.IsNullOrWhiteSpace(types)) return null;
        var result = new List<int>();
        foreach (var part in types.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            if (!Enum.TryParse<HistoryEventType>(part, true, out var value) || !Enum.IsDefined(value))
                throw new BusinessValidationException("A history event type is invalid.");
            result.Add((int)value);
        }
        return result.Distinct().ToArray();
    }

    private static string Encode(DateTime time, int type, int id)
        => Convert.ToBase64String(Encoding.UTF8.GetBytes(
            $"{time.Ticks}:{type}:{id}"));

    private static bool TryDecode(string cursor, out DateTime time, out int type, out int id)
    {
        time = default;
        type = id = 0;
        try
        {
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(cursor)).Split(':');
            if (parts.Length != 3 || !long.TryParse(parts[0], NumberStyles.None,
                CultureInfo.InvariantCulture, out var ticks)
                || !int.TryParse(parts[1], out type) || !int.TryParse(parts[2], out id)
                || !Enum.IsDefined((HistoryEventType)type) || id <= 0)
                return false;
            time = new DateTime(ticks, DateTimeKind.Utc);
            return true;
        }
        catch (Exception exception) when (exception is FormatException or ArgumentOutOfRangeException)
        {
            return false;
        }
    }

}
