using FitnessApp.Api.DTOs.Achievements;
using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Services.Achievements;

public interface IAchievementService
{
    Task<IReadOnlyList<AchievementDto>> GetAllAsync(int userId, CancellationToken cancellationToken);
    Task<AchievementDto> GetAsync(int userId, AchievementType type, CancellationToken cancellationToken);
    Task UpdateFoodProgressAsync(int userId, CancellationToken cancellationToken);
    Task UpdateWeightProgressAsync(int userId, CancellationToken cancellationToken);
}
