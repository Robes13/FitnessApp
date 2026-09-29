using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.FoodLogs;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.FoodLogs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/food-logs")]
public sealed class FoodLogsController(IFoodLogService foodLogService) : ControllerBase
{
    private readonly IFoodLogService _foodLogService = foodLogService;

    [HttpGet]
    public async Task<ActionResult<CursorPage<FoodLogDto>>> GetHistory(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 50,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _foodLogService.GetHistoryAsync(User.GetUserId(), from, to, limit, cursor, cancellationToken));
    }

    [HttpGet("{foodLogId:int}")]
    public async Task<ActionResult<FoodLogDto>> Get(int foodLogId, CancellationToken cancellationToken)
    {
        return Ok(await _foodLogService.GetAsync(User.GetUserId(), foodLogId, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<FoodLogDto>> Create(CreateFoodLogRequest request, CancellationToken cancellationToken)
    {
        var log = await _foodLogService.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { foodLogId = log.FoodLogId }, log);
    }

    [HttpPatch("{foodLogId:int}")]
    public async Task<ActionResult<FoodLogDto>> Update(int foodLogId, UpdateFoodLogRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _foodLogService.UpdateAsync(User.GetUserId(), foodLogId, request, cancellationToken));
    }

    [HttpDelete("{foodLogId:int}")]
    public async Task<IActionResult> Delete(int foodLogId, CancellationToken cancellationToken)
    {
        await _foodLogService.DeleteAsync(User.GetUserId(), foodLogId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{foodLogId:int}/restore")]
    public async Task<IActionResult> Restore(int foodLogId, CancellationToken cancellationToken)
    {
        await _foodLogService.RestoreAsync(User.GetUserId(), foodLogId, cancellationToken);
        return NoContent();
    }
}
