using FitnessApp.Api.DTOs.Achievements;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Achievements;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/achievements")]
public sealed class AchievementsController(IAchievementService achievementService) : ControllerBase
{
    private readonly IAchievementService _achievementService = achievementService;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AchievementDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await _achievementService.GetAllAsync(User.GetUserId(), cancellationToken));

    [HttpGet("{achievementType}")]
    public async Task<ActionResult<AchievementDto>> Get(AchievementType achievementType,
        CancellationToken cancellationToken)
        => Ok(await _achievementService.GetAsync(User.GetUserId(), achievementType, cancellationToken));
}
