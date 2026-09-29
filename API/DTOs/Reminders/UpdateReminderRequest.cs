using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Reminders;

public sealed record UpdateReminderRequest(
    ReminderType? ReminderType,
    TimeOnly? ReminderTime,
    bool? IsEnabled);
