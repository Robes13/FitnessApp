using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Achievements;
using FitnessApp.Api.Utilities;
using FitnessApp.Api.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Achievements;

public sealed class AchievementService(FitnessAppDbContext context, TimeProvider timeProvider) : IAchievementService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<AchievementDto> GetAsync(int userId, AchievementType type, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(type)) throw new BusinessValidationException("Achievement type is invalid.");
        return (await GetAllAsync(userId, cancellationToken)).Single(item => item.AchievementType == type);
    }

    public async Task UpdateFoodProgressAsync(int userId, CancellationToken cancellationToken)
    {
        var count = await _context.FoodLogs.CountAsync(log => log.UserId == userId && !log.IsDeleted,
            cancellationToken);
        await UpdateAsync(userId, new[] { AchievementType.FirstMeal, AchievementType.TenMeals },
            count, cancellationToken);
    }

    public async Task UpdateWeightProgressAsync(int userId, CancellationToken cancellationToken)
    {
        var count = await _context.WeightLogs.CountAsync(log => log.UserId == userId, cancellationToken);
        await UpdateAsync(userId, new[] { AchievementType.TenWeights }, count, cancellationToken);
    }

    private async Task UpdateAsync(int userId, IReadOnlyList<AchievementType> types, int count,
        CancellationToken cancellationToken)
    {
        var existing = await _context.UserAchievements
            .Where(item => item.UserId == userId && types.Contains(item.AchievementType))
            .ToDictionaryAsync(item => item.AchievementType, cancellationToken);
        foreach (var type in types)
        {
            if (!existing.TryGetValue(type, out var achievement))
            {
                achievement = new UserAchievement { UserId = userId, AchievementType = type };
                _context.UserAchievements.Add(achievement);
            }
            achievement.Progress = count;
            if (achievement.CompletedAt is null && count >= AchievementMetadata.GetCompletionRequirement(type))
                achievement.CompletedAt = _timeProvider.GetUtcNow().UtcDateTime;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AchievementDto>> GetAllAsync(int userId, CancellationToken cancellationToken)
    {
        var progress = await _context.UserAchievements
            .AsNoTracking()
            .Where(achievement => achievement.UserId == userId)
            .ToDictionaryAsync(achievement => achievement.AchievementType, cancellationToken);

        return Enum.GetValues<AchievementType>()
            .Select(type =>
            {
                progress.TryGetValue(type, out var userAchievement);
                return new AchievementDto(
                    type,
                    AchievementMetadata.GetName(type),
                    userAchievement?.Progress ?? 0,
                    AchievementMetadata.GetCompletionRequirement(type),
                    userAchievement?.CompletedAt);
            })
            .ToList();
    }
}
