using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.Goals;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Goals;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/goals")]
public sealed class GoalsController(IUserGoalService goalService) : ControllerBase
{
    private readonly IUserGoalService _goalService = goalService;

    [HttpGet("current")]
    public async Task<ActionResult<UserGoalDto>> GetCurrent(CancellationToken cancellationToken)
    {
        var goal = await _goalService.GetCurrentAsync(User.GetUserId(), cancellationToken);
        return goal is null ? NotFound() : Ok(goal);
    }

    [HttpGet("at")]
    public async Task<ActionResult<UserGoalDto>> GetAt([FromQuery] DateTime at, CancellationToken cancellationToken)
    {
        var goal = await _goalService.GetAtAsync(User.GetUserId(), at, cancellationToken);
        return goal is null ? NotFound() : Ok(goal);
    }

    [HttpGet("{goalId:int}")]
    public async Task<ActionResult<UserGoalDto>> GetById(int goalId, CancellationToken cancellationToken)
    {
        return Ok(await _goalService.GetByIdAsync(User.GetUserId(), goalId, cancellationToken));
    }

    [HttpGet]
    public async Task<ActionResult<CursorPage<UserGoalDto>>> GetHistory(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int limit = 50,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        return Ok(await _goalService.GetHistoryAsync(User.GetUserId(), from, to, limit, cursor, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<UserGoalDto>> Create(CreateUserGoalRequest request, CancellationToken cancellationToken)
    {
        var goal = await _goalService.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { goalId = goal.UserGoalId }, goal);
    }

    [HttpPost("recalculate")]
    public async Task<ActionResult<UserGoalDto>> Recalculate(CancellationToken cancellationToken)
        => Ok(await _goalService.RecalculateAsync(User.GetUserId(), false, cancellationToken));
}
