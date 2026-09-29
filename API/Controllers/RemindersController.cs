using FitnessApp.Api.DTOs.Reminders;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Reminders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/me/reminders")]
public sealed class RemindersController(IReminderService reminderService) : ControllerBase
{
    private readonly IReminderService _reminderService = reminderService;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ReminderDto>>> GetAll(CancellationToken cancellationToken)
        => Ok(await _reminderService.GetAllAsync(User.GetUserId(), cancellationToken));

    [HttpGet("{reminderId:int}")]
    public async Task<ActionResult<ReminderDto>> Get(int reminderId, CancellationToken cancellationToken)
        => Ok(await _reminderService.GetAsync(User.GetUserId(), reminderId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ReminderDto>> Create(CreateReminderRequest request, CancellationToken cancellationToken)
    {
        var reminder = await _reminderService.CreateAsync(User.GetUserId(), request, cancellationToken);
        return CreatedAtAction(nameof(Get), new { reminderId = reminder.ReminderId }, reminder);
    }

    [HttpPatch("{reminderId:int}")]
    public async Task<ActionResult<ReminderDto>> Update(int reminderId, UpdateReminderRequest request, CancellationToken cancellationToken)
        => Ok(await _reminderService.UpdateAsync(User.GetUserId(), reminderId, request, cancellationToken));

    [HttpDelete("{reminderId:int}")]
    public async Task<IActionResult> Delete(int reminderId, CancellationToken cancellationToken)
    {
        await _reminderService.DeleteAsync(User.GetUserId(), reminderId, cancellationToken);
        return NoContent();
    }
}
