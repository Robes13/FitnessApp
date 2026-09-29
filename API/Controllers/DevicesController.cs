using FitnessApp.Api.DTOs.Devices;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Devices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/devices")]
public sealed class DevicesController(IUserDeviceService deviceService) : ControllerBase
{
    private readonly IUserDeviceService _deviceService = deviceService;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UserDeviceDto>>> Get(CancellationToken cancellationToken)
        => Ok(await _deviceService.GetAsync(User.GetUserId(), cancellationToken));

    [HttpPost]
    public async Task<ActionResult<UserDeviceDto>> Register(RegisterDeviceRequest request,
        CancellationToken cancellationToken)
        => StatusCode(StatusCodes.Status201Created,
            await _deviceService.RegisterAsync(User.GetUserId(), request, cancellationToken));

    [HttpDelete("{deviceId:int}")]
    public async Task<IActionResult> Delete(int deviceId, CancellationToken cancellationToken)
    {
        await _deviceService.DeleteAsync(User.GetUserId(), deviceId, cancellationToken);
        return NoContent();
    }
}
