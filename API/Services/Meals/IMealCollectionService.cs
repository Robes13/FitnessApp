using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Meals;

namespace FitnessApp.Api.Services.Meals;

public interface IMealCollectionService
{
    Task<CursorPage<MealCollectionDto>> GetAllAsync(int userId, int limit, string? cursor, CancellationToken cancellationToken);
    Task<MealCollectionDto> GetAsync(int userId, int collectionId, CancellationToken cancellationToken);
    Task<MealCollectionDto> CreateAsync(int userId, CreateMealCollectionRequest request, CancellationToken cancellationToken);
    Task<MealCollectionDto> UpdateAsync(int userId, int collectionId, UpdateMealCollectionRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, int collectionId, CancellationToken cancellationToken);
    Task<MealItemDto> AddItemAsync(int userId, int collectionId, CreateMealItemRequest request, CancellationToken cancellationToken);
    Task<MealItemDto> UpdateItemAsync(int userId, int collectionId, int itemId, UpdateMealItemRequest request, CancellationToken cancellationToken);
    Task DeleteItemAsync(int userId, int collectionId, int itemId, CancellationToken cancellationToken);
    Task<IReadOnlyList<FoodLogDto>> LogAsync(int userId, int collectionId, LogMealCollectionRequest request, CancellationToken cancellationToken);
}
