using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Weights;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Weights;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/weight-logs")]
public sealed class WeightLogsController(IWeightLogService weightLogService) : ControllerBase
{
    private readonly IWeightLogService _weightLogService = weightLogService;

    [HttpGet]
    public async Task<ActionResult<CursorPage<WeightLogDto>>> GetHistory(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int limit = 50, [FromQuery] string? cursor = null, CancellationToken cancellationToken = default)
        => Ok(await _weightLogService.GetHistoryAsync(User.GetUserId(), from, to, limit, cursor, cancellationToken));

    [HttpGet("latest")]
    public async Task<ActionResult<LatestWeightDto>> GetLatest(CancellationToken cancellationToken)
    {
        var log = await _weightLogService.GetLatestAsync(User.GetUserId(), cancellationToken);
        return log is null ? NotFound() : Ok(log);
    }

    [HttpGet("{weightLogId:int}")]
    public async Task<ActionResult<WeightLogDto>> Get(int weightLogId, CancellationToken cancellationToken)
        => Ok(await _weightLogService.GetAsync(User.GetUserId(), weightLogId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<WeightLogDto>> Create(CreateWeightLogRequest request, CancellationToken cancellationToken)
    {
        var log = await _weightLogService.CreateAsync(User.GetUserId(), request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, log);
    }

    [HttpPatch("{weightLogId:int}")]
    public async Task<ActionResult<WeightLogDto>> Update(int weightLogId, UpdateWeightLogRequest request, CancellationToken cancellationToken)
        => Ok(await _weightLogService.UpdateAsync(User.GetUserId(), weightLogId, request, cancellationToken));

    [HttpDelete("{weightLogId:int}")]
    public async Task<IActionResult> Delete(int weightLogId, CancellationToken cancellationToken)
    {
        await _weightLogService.DeleteAsync(User.GetUserId(), weightLogId, cancellationToken);
        return NoContent();
    }
}
