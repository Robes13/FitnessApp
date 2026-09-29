using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.DTOs.Meals;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Meals;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/meal-collections")]
public sealed class MealCollectionsController(IMealCollectionService mealCollectionService) : ControllerBase
{
    private readonly IMealCollectionService _mealCollectionService = mealCollectionService;

    [HttpGet]
    public async Task<ActionResult<CursorPage<MealCollectionDto>>> GetAll([FromQuery] int limit = 30, [FromQuery] string? cursor = null, CancellationToken cancellationToken = default)
        => Ok(await _mealCollectionService.GetAllAsync(User.GetUserId(), limit, cursor, cancellationToken));

    [HttpGet("{collectionId:int}")]
    public async Task<ActionResult<MealCollectionDto>> Get(int collectionId, CancellationToken cancellationToken)
        => Ok(await _mealCollectionService.GetAsync(User.GetUserId(), collectionId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<MealCollectionDto>> Create(CreateMealCollectionRequest request, CancellationToken cancellationToken)
    {
        var collection = await _mealCollectionService.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { collectionId = collection.MealCollectionId }, collection);
    }

    [HttpPatch("{collectionId:int}")]
    public async Task<ActionResult<MealCollectionDto>> Update(int collectionId, UpdateMealCollectionRequest request, CancellationToken cancellationToken)
        => Ok(await _mealCollectionService.UpdateAsync(User.GetUserId(), collectionId, request, cancellationToken));

    [HttpDelete("{collectionId:int}")]
    public async Task<IActionResult> Delete(int collectionId, CancellationToken cancellationToken)
    {
        await _mealCollectionService.DeleteAsync(User.GetUserId(), collectionId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{collectionId:int}/items")]
    public async Task<ActionResult<MealItemDto>> AddItem(int collectionId, CreateMealItemRequest request, CancellationToken cancellationToken)
    {
        var item = await _mealCollectionService.AddItemAsync(User.GetUserId(), collectionId, request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, item);
    }

    [HttpPatch("{collectionId:int}/items/{itemId:int}")]
    public async Task<ActionResult<MealItemDto>> UpdateItem(int collectionId, int itemId, UpdateMealItemRequest request, CancellationToken cancellationToken)
        => Ok(await _mealCollectionService.UpdateItemAsync(User.GetUserId(), collectionId, itemId, request, cancellationToken));

    [HttpDelete("{collectionId:int}/items/{itemId:int}")]
    public async Task<IActionResult> DeleteItem(int collectionId, int itemId, CancellationToken cancellationToken)
    {
        await _mealCollectionService.DeleteItemAsync(User.GetUserId(), collectionId, itemId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{collectionId:int}/log")]
    public async Task<ActionResult<IReadOnlyList<FoodLogDto>>> Log(int collectionId, LogMealCollectionRequest request, CancellationToken cancellationToken)
        => Ok(await _mealCollectionService.LogAsync(User.GetUserId(), collectionId, request, cancellationToken));
}
