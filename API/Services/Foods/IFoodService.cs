using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Foods;

namespace FitnessApp.Api.Services.Foods;

public interface IFoodService
{
    Task<CursorPage<FoodDto>> SearchAsync(string? query, string? barcode, bool createdByMe, int userId, int limit, string? cursor, CancellationToken cancellationToken);
    Task<FoodDto> GetAsync(int userId, int foodId, CancellationToken cancellationToken);
    Task<FoodDto> CreateAsync(int userId, CreateFoodRequest request, CancellationToken cancellationToken);
    Task<FoodDto> UpdateAsync(int userId, int foodId, UpdateFoodRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, int foodId, CancellationToken cancellationToken);
    Task<FoodServingDto> UpsertServingAsync(int userId, int foodId, UpsertFoodServingRequest request, CancellationToken cancellationToken);
    Task DeleteServingAsync(int userId, int foodId, ServingUnit unit, CancellationToken cancellationToken);
}
