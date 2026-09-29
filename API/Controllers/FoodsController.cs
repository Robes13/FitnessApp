using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Foods;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Foods;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/foods")]
public sealed class FoodsController(IFoodService foodService) : ControllerBase
{
    private readonly IFoodService _foodService = foodService;

    [HttpGet]
    public async Task<ActionResult<CursorPage<FoodDto>>> Search(
        [FromQuery] string? query,
        [FromQuery] string? barcode,
        [FromQuery] bool createdByMe = false,
        [FromQuery] int limit = 30,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _foodService.SearchAsync(query, barcode, createdByMe, User.GetUserId(), limit, cursor, cancellationToken));
    }

    [HttpGet("{foodId:int}")]
    public async Task<ActionResult<FoodDto>> Get(int foodId, CancellationToken cancellationToken)
    {
        return Ok(await _foodService.GetAsync(User.GetUserId(), foodId, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<FoodDto>> Create(CreateFoodRequest request, CancellationToken cancellationToken)
    {
        var food = await _foodService.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { foodId = food.FoodId }, food);
    }

    [HttpPatch("{foodId:int}")]
    public async Task<ActionResult<FoodDto>> Update(int foodId, UpdateFoodRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _foodService.UpdateAsync(User.GetUserId(), foodId, request, cancellationToken));
    }

    [HttpDelete("{foodId:int}")]
    public async Task<IActionResult> Delete(int foodId, CancellationToken cancellationToken)
    {
        await _foodService.DeleteAsync(User.GetUserId(), foodId, cancellationToken);
        return NoContent();
    }

    [HttpGet("{foodId:int}/servings")]
    public async Task<ActionResult<IReadOnlyList<FoodServingDto>>> GetServings(
        int foodId, CancellationToken cancellationToken)
    {
        var food = await _foodService.GetAsync(User.GetUserId(), foodId, cancellationToken);
        return Ok(food.Servings);
    }

    [HttpPut("{foodId:int}/servings/{unit}")]
    public async Task<ActionResult<FoodServingDto>> UpsertServing(
        int foodId, ServingUnit unit, UpsertFoodServingRequest request, CancellationToken cancellationToken)
    {
        request = request with { Unit = unit };
        return Ok(await _foodService.UpsertServingAsync(User.GetUserId(), foodId, request, cancellationToken));
    }

    [HttpDelete("{foodId:int}/servings/{unit}")]
    public async Task<IActionResult> DeleteServing(int foodId, ServingUnit unit, CancellationToken cancellationToken)
    {
        await _foodService.DeleteServingAsync(User.GetUserId(), foodId, unit, cancellationToken);
        return NoContent();
    }
}
