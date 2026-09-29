using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Reminders;

public sealed record ReminderDto(
    int ReminderId,
    ReminderType ReminderType,
    TimeOnly ReminderTime,
    bool IsEnabled);
