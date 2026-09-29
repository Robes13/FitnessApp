using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Nutrition;

namespace FitnessApp.Api.Services.Nutrition;

public interface INutritionService
{
    Task<CursorPage<NutritionHistoryItemDto>> GetHistoryAsync(
        int userId,
        DateTime from,
        DateTime to,
        int limit,
        string? cursor,
        CancellationToken cancellationToken);
    Task<IReadOnlyList<NutritionDayDto>> GetDaysAsync(int userId, DateOnly from, DateOnly to, CancellationToken cancellationToken);
    Task<NutritionDayDto> GetTodayAsync(int userId, CancellationToken cancellationToken);
}
