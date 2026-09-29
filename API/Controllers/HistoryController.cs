using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.DTOs.History;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.History;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/history")]
public sealed class HistoryController(IHistoryService historyService) : ControllerBase
{
    private readonly IHistoryService _historyService = historyService;

    [HttpGet]
    public async Task<ActionResult<CursorPage<HistoryEventDto>>> Get(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] string? types,
        [FromQuery] int limit = 50,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
        => Ok(await _historyService.GetAsync(User.GetUserId(), from, to, types,
            limit, cursor, cancellationToken));
}
