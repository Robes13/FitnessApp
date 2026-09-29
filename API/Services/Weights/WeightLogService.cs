using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Weights;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Achievements;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Utilities;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Weights;

public sealed class WeightLogService(
    FitnessAppDbContext context,
    IUserGoalService goalService,
    IAchievementService achievementService) : IWeightLogService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IUserGoalService _goalService = goalService;
    private readonly IAchievementService _achievementService = achievementService;

    public async Task<LatestWeightDto?> GetLatestAsync(int userId, CancellationToken cancellationToken)
    {
        var log = await _context.WeightLogs
            .AsNoTracking()
            .Where(log => log.UserId == userId)
            .OrderByDescending(log => log.RecordedAt)
            .ThenByDescending(log => log.WeightLogId)
            .FirstOrDefaultAsync(cancellationToken);

        if (log is not null)
            return new LatestWeightDto(log.WeightLogId, log.Weight, log.RecordedAt, false);

        var starting = await _context.UserProfiles.AsNoTracking()
            .Where(profile => profile.UserId == userId)
            .Select(profile => new { profile.StartingWeight, profile.User.CreatedAt })
            .SingleOrDefaultAsync(cancellationToken);
        return starting is null || starting.StartingWeight <= 0m
            ? null : new LatestWeightDto(null, starting.StartingWeight, starting.CreatedAt, true);
    }

    public async Task<WeightLogDto> GetAsync(int userId, int weightLogId, CancellationToken cancellationToken)
    {
        var log = await _context.WeightLogs.AsNoTracking().SingleOrDefaultAsync(
            candidate => candidate.UserId == userId && candidate.WeightLogId == weightLogId,
            cancellationToken) ?? throw new NotFoundException("Weight log not found.");
        return ToDto(log);
    }

    public async Task<CursorPage<WeightLogDto>> GetHistoryAsync(
        int userId, DateTime? from, DateTime? to, int limit, string? cursor, CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit);
        var query = _context.WeightLogs.AsNoTracking().Where(log => log.UserId == userId);

        if (from.HasValue && to.HasValue)
        {
            RequestGuards.EnsureRange(RequestGuards.NormalizeUtc(from.Value), RequestGuards.NormalizeUtc(to.Value));
        }

        if (from.HasValue)
        {
            var normalized = RequestGuards.NormalizeUtc(from.Value);
            query = query.Where(log => log.RecordedAt >= normalized);
        }

        if (to.HasValue)
        {
            var normalized = RequestGuards.NormalizeUtc(to.Value);
            query = query.Where(log => log.RecordedAt < normalized);
        }

        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecode(cursor, out var cursorTime, out var cursorId))
            {
                throw new BusinessValidationException("The cursor is invalid.");
            }

            query = query.Where(log => log.RecordedAt < cursorTime
                || (log.RecordedAt == cursorTime && log.WeightLogId < cursorId));
        }

        var logs = await query
            .OrderByDescending(log => log.RecordedAt)
            .ThenByDescending(log => log.WeightLogId)
            .Take(limit + 1)
            .ToListAsync(cancellationToken);

        var hasMore = logs.Count > limit;
        if (hasMore) logs.RemoveAt(logs.Count - 1);

        var nextCursor = hasMore && logs.Count > 0
            ? CursorCodec.Encode(logs[^1].RecordedAt, logs[^1].WeightLogId)
            : null;

        return new CursorPage<WeightLogDto>(logs.Select(ToDto).ToList(), nextCursor, hasMore);
    }

    public async Task<WeightLogDto> CreateAsync(int userId, CreateWeightLogRequest request, CancellationToken cancellationToken)
    {
        ValidateWeight(request.Weight);
        var recordedAt = RequestGuards.NormalizeUtc(request.RecordedAt);
        var recordedDate = await GetRecordedDateAsync(userId, recordedAt, cancellationToken);
        var existingId = await _context.WeightLogs.Where(candidate => candidate.UserId == userId
            && candidate.RecordedDate == recordedDate)
            .Select(candidate => candidate.WeightLogId).FirstOrDefaultAsync(cancellationToken);
        if (existingId != 0) throw new WeightDateConflictException(existingId);

        var log = new WeightLog
        {
            UserId = userId,
            Weight = request.Weight,
            RecordedAt = recordedAt,
            RecordedDate = recordedDate
        };

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.WeightLogs.Add(log);
        await _context.SaveChangesAsync(cancellationToken);
        await _achievementService.UpdateWeightProgressAsync(userId, cancellationToken);
        if (await IsLatestAsync(userId, log.WeightLogId, cancellationToken)
            && await _context.UserGoals.AnyAsync(goal => goal.UserId == userId, cancellationToken))
            await _goalService.RecalculateAsync(userId, true, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToDto(log);
    }

    public async Task<WeightLogDto> UpdateAsync(
        int userId, int weightLogId, UpdateWeightLogRequest request, CancellationToken cancellationToken)
    {
        var log = await _context.WeightLogs
            .SingleOrDefaultAsync(log => log.WeightLogId == weightLogId && log.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("Weight log not found.");

        var wasLatest = await IsLatestAsync(userId, weightLogId, cancellationToken);
        var previousWeight = log.Weight;
        var previousTime = log.RecordedAt;

        if (request.Weight.HasValue)
        {
            ValidateWeight(request.Weight.Value);
            log.Weight = request.Weight.Value;
        }

        if (request.RecordedAt.HasValue)
        {
            log.RecordedAt = RequestGuards.NormalizeUtc(request.RecordedAt.Value);
            log.RecordedDate = await GetRecordedDateAsync(userId, log.RecordedAt, cancellationToken);
        }

        var existingId = await _context.WeightLogs.Where(candidate => candidate.UserId == userId
            && candidate.RecordedDate == log.RecordedDate && candidate.WeightLogId != weightLogId)
            .Select(candidate => candidate.WeightLogId).FirstOrDefaultAsync(cancellationToken);
        if (existingId != 0) throw new WeightDateConflictException(existingId);

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        if ((log.Weight != previousWeight || log.RecordedAt != previousTime)
            && (wasLatest || await IsLatestAsync(userId, weightLogId, cancellationToken))
            && await _context.UserGoals.AnyAsync(goal => goal.UserId == userId, cancellationToken))
            await _goalService.RecalculateAsync(userId, true, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return ToDto(log);
    }

    public async Task DeleteAsync(int userId, int weightLogId, CancellationToken cancellationToken)
    {
        var log = await _context.WeightLogs
            .SingleOrDefaultAsync(log => log.WeightLogId == weightLogId && log.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("Weight log not found.");

        var wasLatest = await IsLatestAsync(userId, weightLogId, cancellationToken);
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        _context.WeightLogs.Remove(log);
        await _context.SaveChangesAsync(cancellationToken);
        await _achievementService.UpdateWeightProgressAsync(userId, cancellationToken);
        if (wasLatest && await _context.UserGoals.AnyAsync(goal => goal.UserId == userId, cancellationToken))
            await _goalService.RecalculateAsync(userId, true, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private async Task<DateOnly> GetRecordedDateAsync(int userId, DateTime recordedAt, CancellationToken cancellationToken)
    {
        var timeZoneId = await _context.UserProfiles.Where(profile => profile.UserId == userId)
            .Select(profile => profile.TimeZoneId).SingleOrDefaultAsync(cancellationToken)
            ?? throw new BusinessValidationException("Complete a profile with a time zone before recording weight.");
        var localTime = TimeZoneInfo.ConvertTimeFromUtc(recordedAt,
            TimeZoneInfo.FindSystemTimeZoneById(timeZoneId));
        return DateOnly.FromDateTime(localTime);
    }

    private async Task<bool> IsLatestAsync(int userId, int weightLogId, CancellationToken cancellationToken)
        => await _context.WeightLogs.Where(log => log.UserId == userId)
            .OrderByDescending(log => log.RecordedAt).ThenByDescending(log => log.WeightLogId)
            .Select(log => log.WeightLogId).FirstOrDefaultAsync(cancellationToken) == weightLogId;

    private static void ValidateWeight(decimal weight)
    {
        if (weight is < 25m or > 400m)
        {
            throw new BusinessValidationException("Weight must be between 25 and 400 kg.");
        }
    }

    private static WeightLogDto ToDto(WeightLog log)
    {
        return new WeightLogDto(log.WeightLogId, log.Weight, log.RecordedAt, log.RecordedDate);
    }
}
