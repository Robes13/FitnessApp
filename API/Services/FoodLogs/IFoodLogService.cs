using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.FoodLogs;

namespace FitnessApp.Api.Services.FoodLogs;

public interface IFoodLogService
{
    Task<FoodLogDto> GetAsync(int userId, int foodLogId, CancellationToken cancellationToken);
    Task<CursorPage<FoodLogDto>> GetHistoryAsync(
        int userId,
        DateTime? from,
        DateTime? to,
        int limit,
        string? cursor,
        CancellationToken cancellationToken);
    Task<FoodLogDto> CreateAsync(int userId, CreateFoodLogRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<FoodLogDto>> CreateManyAsync(int userId, IReadOnlyList<CreateFoodLogRequest> requests, CancellationToken cancellationToken);
    Task<FoodLogDto> UpdateAsync(int userId, int foodLogId, UpdateFoodLogRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, int foodLogId, CancellationToken cancellationToken);
    Task RestoreAsync(int userId, int foodLogId, CancellationToken cancellationToken);
}
