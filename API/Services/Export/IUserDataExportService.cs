using FitnessApp.Api.DTOs.Export;

namespace FitnessApp.Api.Services.Export;

public interface IUserDataExportService
{
    Task<UserDataExportDto> GetAsync(int userId, CancellationToken cancellationToken);
}
