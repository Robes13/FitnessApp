using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.DTOs.Export;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Services.Export;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me")]
public sealed class MeController(
    IUserAccountService userAccountService,
    IUserDataExportService exportService) : ControllerBase
{
    private readonly IUserAccountService _userAccountService = userAccountService;
    private readonly IUserDataExportService _exportService = exportService;

    [HttpGet("data-export")]
    public async Task<ActionResult<UserDataExportDto>> Export(CancellationToken cancellationToken)
        => Ok(await _exportService.GetAsync(User.GetUserId(), cancellationToken));

    [HttpGet]
    public async Task<ActionResult<UserDto>> Get(CancellationToken cancellationToken)
    {
        return Ok(await _userAccountService.GetAsync(User.GetUserId(), cancellationToken));
    }

    [HttpPatch]
    public async Task<ActionResult<UserDto>> Update(UpdateAccountRequest request, CancellationToken cancellationToken)
        => Ok(await _userAccountService.UpdateAsync(User.GetUserId(), request, cancellationToken));

    [HttpDelete]
    public async Task<IActionResult> Delete(CancellationToken cancellationToken)
    {
        await _userAccountService.SoftDeleteAsync(User.GetUserId(), cancellationToken);
        return NoContent();
    }
}
