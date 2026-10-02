using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Goals;

namespace FitnessApp.Api.Services.Goals;

public interface IUserGoalService
{
    Task<UserGoalDto?> GetCurrentAsync(int userId, CancellationToken cancellationToken);
    Task<UserGoalDto?> GetAtAsync(int userId, DateTime at, CancellationToken cancellationToken);
    Task<UserGoalDto> GetByIdAsync(int userId, int goalId, CancellationToken cancellationToken);
    Task<CursorPage<UserGoalDto>> GetHistoryAsync(
        int userId,
        DateTime? from,
        DateTime? to,
        int limit,
        string? cursor,
        CancellationToken cancellationToken);
    Task<UserGoalDto> CreateAsync(int userId, CreateUserGoalRequest request, CancellationToken cancellationToken);
    Task<UserGoalDto> RecalculateAsync(int userId, CancellationToken cancellationToken);
}
