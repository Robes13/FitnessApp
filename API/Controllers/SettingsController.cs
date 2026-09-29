using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Settings;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/settings")]
public sealed class SettingsController(IUserSettingService settingService) : ControllerBase
{
    private readonly IUserSettingService _settingService = settingService;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserSettingDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await _settingService.GetAllAsync(User.GetUserId(), cancellationToken));

    [HttpGet("{key}")]
    public async Task<ActionResult<UserSettingDto>> Get(SettingKey key, CancellationToken cancellationToken)
    {
        var setting = await _settingService.GetAsync(User.GetUserId(), key, cancellationToken);
        return setting is null ? NotFound() : Ok(setting);
    }

    [HttpPut("{key}")]
    public async Task<ActionResult<UserSettingDto>> Upsert(SettingKey key, UpsertUserSettingRequest request, CancellationToken cancellationToken)
        => Ok(await _settingService.UpsertAsync(User.GetUserId(), key, request, cancellationToken));

    [HttpDelete("{key}")]
    public async Task<IActionResult> Delete(SettingKey key, CancellationToken cancellationToken)
    {
        await _settingService.DeleteAsync(User.GetUserId(), key, cancellationToken);
        return NoContent();
    }
}
