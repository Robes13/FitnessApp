using FitnessApp.Api.DTOs.Devices;

namespace FitnessApp.Api.Services.Devices;

public interface IUserDeviceService
{
    Task<IReadOnlyList<UserDeviceDto>> GetAsync(int userId, CancellationToken cancellationToken);
    Task<UserDeviceDto> RegisterAsync(int userId, RegisterDeviceRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, int deviceId, CancellationToken cancellationToken);
}
