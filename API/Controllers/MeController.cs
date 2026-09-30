using System.Globalization;
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
    IUserDataExportService exportService,
    TimeProvider timeProvider) : ControllerBase
{
    private readonly IUserAccountService _userAccountService = userAccountService;
    private readonly IUserDataExportService _exportService = exportService;
    private readonly TimeProvider _timeProvider = timeProvider;

    [HttpGet("data-export")]
    public async Task<ActionResult<UserDataExportDto>> Export(CancellationToken cancellationToken)
        => Ok(await _exportService.GetAsync(User.GetUserId(), cancellationToken));

    [HttpPost("data-export/token")]
    public ActionResult<DataExportTokenDto> CreateExportToken()
        => Ok(new DataExportTokenDto(_exportService.CreateDownloadToken(User.GetUserId())));

    // The token travels in the query string, never the path: GlobalExceptionHandler logs Request.Path on a 5xx.
    [AllowAnonymous]
    [HttpGet("/api/v1/data-export")]
    public async Task<ActionResult<UserDataExportDto>> DownloadExport([FromQuery] string? token,
        CancellationToken cancellationToken)
    {
        var export = await _exportService.GetByDownloadTokenAsync(token, cancellationToken);
        var date = _timeProvider.GetUtcNow().UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        Response.Headers.ContentDisposition = $"attachment; filename=\"nutrify-data-{date}.json\"";
        Response.Headers.CacheControl = "no-store";
        return Ok(export);
    }

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
