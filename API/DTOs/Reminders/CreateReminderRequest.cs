using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Reminders;

public sealed record CreateReminderRequest(
    ReminderType ReminderType,
    TimeOnly ReminderTime,
    bool IsEnabled);
