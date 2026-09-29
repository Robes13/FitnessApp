using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Reminders;
using FitnessApp.Api.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Reminders;

public sealed class ReminderService(FitnessAppDbContext context) : IReminderService
{
    private readonly FitnessAppDbContext _context = context;

    public async Task<IReadOnlyList<ReminderDto>> GetAllAsync(int userId, CancellationToken cancellationToken)
    {
        return await _context.Reminders
            .AsNoTracking()
            .Where(reminder => reminder.UserId == userId)
            .OrderBy(reminder => reminder.ReminderTime)
            .Select(reminder => new ReminderDto(reminder.ReminderId, reminder.ReminderType, reminder.ReminderTime, reminder.IsEnabled))
            .ToListAsync(cancellationToken);
    }

    public async Task<ReminderDto> GetAsync(int userId, int reminderId, CancellationToken cancellationToken)
    {
        var reminder = await _context.Reminders.AsNoTracking()
            .SingleOrDefaultAsync(reminder => reminder.ReminderId == reminderId && reminder.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("Reminder not found.");
        return ToDto(reminder);
    }

    public async Task<ReminderDto> CreateAsync(int userId, CreateReminderRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.ReminderType))
        {
            throw new BusinessValidationException("ReminderType is invalid.");
        }
        if (await _context.Reminders.CountAsync(reminder => reminder.UserId == userId,
            cancellationToken) >= 20)
            throw new ConflictException("At most 20 reminders can be configured.");

        var reminder = new Reminder
        {
            UserId = userId,
            ReminderType = request.ReminderType,
            ReminderTime = request.ReminderTime,
            IsEnabled = request.IsEnabled
        };
        _context.Reminders.Add(reminder);
        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(reminder);
    }

    public async Task<ReminderDto> UpdateAsync(int userId, int reminderId, UpdateReminderRequest request, CancellationToken cancellationToken)
    {
        var reminder = await _context.Reminders
            .SingleOrDefaultAsync(reminder => reminder.ReminderId == reminderId && reminder.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("Reminder not found.");

        if (request.ReminderType.HasValue)
        {
            if (!Enum.IsDefined(request.ReminderType.Value))
            {
                throw new BusinessValidationException("ReminderType is invalid.");
            }
            reminder.ReminderType = request.ReminderType.Value;
        }
        if (request.ReminderTime.HasValue) reminder.ReminderTime = request.ReminderTime.Value;
        if (request.IsEnabled.HasValue) reminder.IsEnabled = request.IsEnabled.Value;

        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(reminder);
    }

    public async Task DeleteAsync(int userId, int reminderId, CancellationToken cancellationToken)
    {
        var reminder = await _context.Reminders
            .SingleOrDefaultAsync(reminder => reminder.ReminderId == reminderId && reminder.UserId == userId, cancellationToken)
            ?? throw new NotFoundException("Reminder not found.");
        _context.Reminders.Remove(reminder);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static ReminderDto ToDto(Reminder reminder)
        => new(reminder.ReminderId, reminder.ReminderType, reminder.ReminderTime, reminder.IsEnabled);
}
