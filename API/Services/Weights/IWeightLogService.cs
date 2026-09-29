using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Weights;

namespace FitnessApp.Api.Services.Weights;

public interface IWeightLogService
{
    Task<LatestWeightDto?> GetLatestAsync(int userId, CancellationToken cancellationToken);
    Task<WeightLogDto> GetAsync(int userId, int weightLogId, CancellationToken cancellationToken);
    Task<CursorPage<WeightLogDto>> GetHistoryAsync(int userId, DateTime? from, DateTime? to, int limit, string? cursor, CancellationToken cancellationToken);
    Task<WeightLogDto> CreateAsync(int userId, CreateWeightLogRequest request, CancellationToken cancellationToken);
    Task<WeightLogDto> UpdateAsync(int userId, int weightLogId, UpdateWeightLogRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, int weightLogId, CancellationToken cancellationToken);
}
