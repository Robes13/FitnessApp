using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Nutrition;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Nutrition;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/nutrition")]
public sealed class NutritionController(INutritionService nutritionService) : ControllerBase
{
    private readonly INutritionService _nutritionService = nutritionService;

    [HttpGet("today")]
    public async Task<ActionResult<NutritionDayDto>> GetToday(CancellationToken cancellationToken)
        => Ok(await _nutritionService.GetTodayAsync(User.GetUserId(), cancellationToken));

    [HttpGet("days/{date}")]
    public async Task<ActionResult<NutritionDayDto>> GetDay(DateOnly date, CancellationToken cancellationToken)
        => Ok((await _nutritionService.GetDaysAsync(User.GetUserId(), date, date.AddDays(1), cancellationToken))[0]);

    [HttpGet("days")]
    public async Task<ActionResult<IReadOnlyList<NutritionDayDto>>> GetDays(
        [FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken cancellationToken)
        => Ok(await _nutritionService.GetDaysAsync(User.GetUserId(), from, to, cancellationToken));

    [HttpGet("history")]
    public async Task<ActionResult<CursorPage<NutritionHistoryItemDto>>> GetHistory(
        [FromQuery] DateTime from,
        [FromQuery] DateTime to,
        [FromQuery] int limit = 50,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _nutritionService.GetHistoryAsync(User.GetUserId(), from, to, limit, cursor, cancellationToken));
    }
}
