using FitnessApp.Api.DTOs.Profile;

namespace FitnessApp.Api.Services.Profiles;

public interface IProfileImageService
{
    Task<ProfileImageDto> UploadAsync(int userId, IFormFile file, CancellationToken cancellationToken);
    Task<string> GetUrlAsync(int userId, CancellationToken cancellationToken);
    Task DeleteAsync(int userId, CancellationToken cancellationToken);
}
