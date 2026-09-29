using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Settings;

namespace FitnessApp.Api.Services.Settings;

public interface IUserSettingService
{
    Task<IReadOnlyList<UserSettingDto>> GetAllAsync(int userId, CancellationToken cancellationToken);
    Task<UserSettingDto?> GetAsync(int userId, SettingKey key, CancellationToken cancellationToken);
    Task<UserSettingDto> UpsertAsync(int userId, SettingKey key, UpsertUserSettingRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, SettingKey key, CancellationToken cancellationToken);
}
