using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Consent;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Consent;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/consents")]
public sealed class ConsentsController(IConsentService consentService) : ControllerBase
{
    private readonly IConsentService _consentService = consentService;

    [HttpGet]
    public async Task<ActionResult<CursorPage<UserConsentDto>>> Get(
        [FromQuery] int limit = 50, [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
        => Ok(await _consentService.GetAsync(User.GetUserId(), limit, cursor, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<UserConsentDto>> Grant(GrantConsentRequest request, CancellationToken cancellationToken)
        => StatusCode(StatusCodes.Status201Created,
            await _consentService.GrantAsync(User.GetUserId(), request, cancellationToken));

    [HttpPost("{consentType}/withdraw")]
    public async Task<IActionResult> Withdraw(ConsentType consentType, CancellationToken cancellationToken)
    {
        await _consentService.WithdrawAsync(User.GetUserId(), consentType, cancellationToken);
        return NoContent();
    }
}
