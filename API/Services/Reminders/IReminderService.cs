using FitnessApp.Api.DTOs.Reminders;

namespace FitnessApp.Api.Services.Reminders;

public interface IReminderService
{
    Task<IReadOnlyList<ReminderDto>> GetAllAsync(int userId, CancellationToken cancellationToken);
    Task<ReminderDto> GetAsync(int userId, int reminderId, CancellationToken cancellationToken);
    Task<ReminderDto> CreateAsync(int userId, CreateReminderRequest request, CancellationToken cancellationToken);
    Task<ReminderDto> UpdateAsync(int userId, int reminderId, UpdateReminderRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, int reminderId, CancellationToken cancellationToken);
}
