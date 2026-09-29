using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.History;

namespace FitnessApp.Api.Services.History;

public interface IHistoryService
{
    Task<CursorPage<HistoryEventDto>> GetAsync(
        int userId, DateTime? from, DateTime? to, string? types,
        int limit, string? cursor, CancellationToken cancellationToken);
}
