using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Goals;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Goals;

public sealed class UserGoalService(FitnessAppDbContext context, TimeProvider timeProvider) : IUserGoalService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<UserGoalDto?> GetCurrentAsync(int userId, CancellationToken cancellationToken)
    {
        var goal = await _context.UserGoals
            .AsNoTracking()
            .Where(goal => goal.UserId == userId)
            .OrderByDescending(goal => goal.CreatedAt)
            .ThenByDescending(goal => goal.UserGoalId)
            .FirstOrDefaultAsync(cancellationToken);

        return goal is null ? null : ToDto(goal);
    }

    public async Task<UserGoalDto?> GetAtAsync(int userId, DateTime at, CancellationToken cancellationToken)
    {
        at = RequestGuards.NormalizeUtc(at);

        var goal = await _context.UserGoals
            .AsNoTracking()
            .Where(goal => goal.UserId == userId && goal.CreatedAt <= at)
            .OrderByDescending(goal => goal.CreatedAt)
            .ThenByDescending(goal => goal.UserGoalId)
            .FirstOrDefaultAsync(cancellationToken);

        return goal is null ? null : ToDto(goal);
    }

    public async Task<UserGoalDto> GetByIdAsync(int userId, int goalId, CancellationToken cancellationToken)
    {
        var goal = await _context.UserGoals
            .AsNoTracking()
            .SingleOrDefaultAsync(
                goal => goal.UserGoalId == goalId && goal.UserId == userId,
                cancellationToken)
            ?? throw new NotFoundException("Goal not found.");

        return ToDto(goal);
    }

    public async Task<CursorPage<UserGoalDto>> GetHistoryAsync(
        int userId,
        DateTime? from,
        DateTime? to,
        int limit,
        string? cursor,
        CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit);
        if (from.HasValue && to.HasValue)
            RequestGuards.EnsureRange(RequestGuards.NormalizeUtc(from.Value), RequestGuards.NormalizeUtc(to.Value));
        var query = _context.UserGoals.AsNoTracking().Where(goal => goal.UserId == userId);

        if (from.HasValue)
        {
            var normalizedFrom = RequestGuards.NormalizeUtc(from.Value);
            query = query.Where(goal => goal.CreatedAt >= normalizedFrom);
        }

        if (to.HasValue)
        {
            var normalizedTo = RequestGuards.NormalizeUtc(to.Value);
            query = query.Where(goal => goal.CreatedAt < normalizedTo);
        }

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecode(cursor, out var cursorTime, out var cursorId))
            {
                throw new BusinessValidationException("The cursor is invalid.");
            }

            query = query.Where(goal => goal.CreatedAt < cursorTime
                || (goal.CreatedAt == cursorTime && goal.UserGoalId < cursorId));
        }

        var goals = await query
            .OrderByDescending(goal => goal.CreatedAt)
            .ThenByDescending(goal => goal.UserGoalId)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var hasMore = goals.Count > limit;
        if (hasMore)
        {
            goals.RemoveAt(goals.Count - 1);
        }

        var nextCursor = hasMore && goals.Count > 0
            ? CursorCodec.Encode(goals[^1].CreatedAt, goals[^1].UserGoalId)
            : null;

        return new CursorPage<UserGoalDto>(goals.Select(ToDto).ToList(), nextCursor, hasMore);
    }

    public async Task<UserGoalDto> CreateAsync(
        int userId,
        CreateUserGoalRequest request,
        CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(userId, cancellationToken);
        var currentWeight = await GetCurrentWeightAsync(userId, profile.StartingWeight, cancellationToken);
        var goal = GoalCalculator.Calculate(userId, profile, currentWeight,
            request.GoalType, request.TargetWeight, request.WeightChangePerWeek,
            _timeProvider.GetUtcNow().UtcDateTime);
        var previous = await _context.UserGoals.AsNoTracking()
            .Where(candidate => candidate.UserId == userId)
            .OrderByDescending(candidate => candidate.CreatedAt)
            .ThenByDescending(candidate => candidate.UserGoalId)
            .FirstOrDefaultAsync(cancellationToken);
        if (previous is not null && previous.GoalType == goal.GoalType
            && previous.TargetWeight == goal.TargetWeight
            && previous.WeightChangePerWeek == goal.WeightChangePerWeek
            && previous.TargetDailyCalories == goal.TargetDailyCalories
            && previous.TargetProtein == goal.TargetProtein
            && previous.TargetCarbohydrates == goal.TargetCarbohydrates
            && previous.TargetFat == goal.TargetFat)
            throw new ConflictException("The current goal already matches these choices.");
        _context.UserGoals.Add(goal);
        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(goal);
    }

    public async Task<UserGoalDto> RecalculateAsync(int userId, CancellationToken cancellationToken)
    {
        var profile = await GetProfileAsync(userId, cancellationToken);
        var previous = await _context.UserGoals
            .Where(goal => goal.UserId == userId)
            .OrderByDescending(goal => goal.CreatedAt)
            .ThenByDescending(goal => goal.UserGoalId)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("No goal exists to recalculate.");
        var currentWeight = await GetCurrentWeightAsync(userId, profile.StartingWeight, cancellationToken);
        var goalType = previous.GoalType;
        var targetWeight = goalType == FitnessApp.Api.Domain.Enums.GoalType.MaintainWeight
            ? currentWeight : previous.TargetWeight;
        if (goalType == FitnessApp.Api.Domain.Enums.GoalType.LoseWeight && currentWeight <= targetWeight
            || goalType == FitnessApp.Api.Domain.Enums.GoalType.GainWeight && currentWeight >= targetWeight)
        {
            goalType = FitnessApp.Api.Domain.Enums.GoalType.MaintainWeight;
            targetWeight = currentWeight;
        }

        var recalculated = GoalCalculator.Calculate(userId, profile, currentWeight, goalType,
            targetWeight,
            goalType == FitnessApp.Api.Domain.Enums.GoalType.MaintainWeight ? 0m : previous.WeightChangePerWeek,
            _timeProvider.GetUtcNow().UtcDateTime);
        // Unchanged numbers keep the current goal, so history only shows real goal changes (spec 7.0).
        if (previous.GoalType == recalculated.GoalType
            && previous.TargetWeight == recalculated.TargetWeight
            && previous.WeightChangePerWeek == recalculated.WeightChangePerWeek
            && previous.TargetDailyCalories == recalculated.TargetDailyCalories
            && previous.TargetProtein == recalculated.TargetProtein
            && previous.TargetCarbohydrates == recalculated.TargetCarbohydrates
            && previous.TargetFat == recalculated.TargetFat)
        {
            return ToDto(previous);
        }

        _context.UserGoals.Add(recalculated);
        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(recalculated);
    }

    private async Task<UserProfile> GetProfileAsync(int userId, CancellationToken cancellationToken)
        => await _context.UserProfiles.SingleOrDefaultAsync(profile => profile.UserId == userId, cancellationToken)
            ?? throw new BusinessValidationException("Complete the profile before setting a goal.");

    private async Task<decimal> GetCurrentWeightAsync(int userId, decimal startingWeight, CancellationToken cancellationToken)
        => await _context.WeightLogs.Where(log => log.UserId == userId)
            .OrderByDescending(log => log.RecordedAt).ThenByDescending(log => log.WeightLogId)
            .Select(log => (decimal?)log.Weight).FirstOrDefaultAsync(cancellationToken)
            ?? startingWeight;

    public static UserGoalDto ToDto(UserGoal goal)
    {
        return new UserGoalDto(
            goal.UserGoalId,
            goal.GoalType,
            goal.TargetWeight,
            goal.WeightChangePerWeek,
            goal.TargetDailyCalories,
            goal.TargetProtein,
            goal.TargetCarbohydrates,
            goal.TargetFat,
            goal.CreatedAt);
    }
}
