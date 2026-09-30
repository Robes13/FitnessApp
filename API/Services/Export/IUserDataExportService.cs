using FitnessApp.Api.DTOs.Export;

namespace FitnessApp.Api.Services.Export;

public interface IUserDataExportService
{
    Task<UserDataExportDto> GetAsync(int userId, CancellationToken cancellationToken);
    string CreateDownloadToken(int userId);
    Task<UserDataExportDto> GetByDownloadTokenAsync(string? token, CancellationToken cancellationToken);
}
