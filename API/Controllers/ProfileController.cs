using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Profiles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/profile")]
public sealed class ProfileController(
    IUserProfileService profileService,
    IProfileImageService profileImageService) : ControllerBase
{
    private readonly IUserProfileService _profileService = profileService;
    private readonly IProfileImageService _profileImageService = profileImageService;

    [HttpGet]
    public async Task<ActionResult<UserProfileDto>> Get(CancellationToken cancellationToken)
    {
        var profile = await _profileService.GetAsync(User.GetUserId(), cancellationToken);
        return profile is null ? NotFound() : Ok(profile);
    }

    [HttpPut]
    public async Task<ActionResult<UserProfileDto>> Upsert(UpsertUserProfileRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _profileService.UpsertAsync(User.GetUserId(), request, cancellationToken));
    }

    [HttpPatch]
    public async Task<ActionResult<UserProfileDto>> Patch(PatchUserProfileRequest request, CancellationToken cancellationToken)
        => Ok(await _profileService.PatchAsync(User.GetUserId(), request, cancellationToken));

    [HttpPut("activity")]
    public async Task<ActionResult<UserProfileDto>> UpdateActivity(UpdateActivityRequest request, CancellationToken cancellationToken)
        => Ok(await _profileService.UpdateActivityAsync(User.GetUserId(), request, cancellationToken));

    [HttpPut("image")]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<ProfileImageDto>> UploadImage(
        [FromForm] UploadProfileImageRequest request, CancellationToken cancellationToken)
        => Ok(await _profileImageService.UploadAsync(User.GetUserId(), request.File, cancellationToken));

    [HttpGet("image")]
    public async Task<IActionResult> GetImage(CancellationToken cancellationToken)
    {
        var imageUrl = await _profileImageService.GetUrlAsync(User.GetUserId(), cancellationToken);
        return Redirect(imageUrl);
    }

    [HttpDelete("image")]
    public async Task<IActionResult> DeleteImage(CancellationToken cancellationToken)
    {
        await _profileImageService.DeleteAsync(User.GetUserId(), cancellationToken);
        return NoContent();
    }
}
