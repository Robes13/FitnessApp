using FitnessApp.Api.DTOs.Profile;

namespace FitnessApp.Api.Services.Profiles;

public interface IUserProfileService
{
    Task<UserProfileDto?> GetAsync(int userId, CancellationToken cancellationToken);
    Task<UserProfileDto> UpsertAsync(int userId, UpsertUserProfileRequest request, CancellationToken cancellationToken);
    Task<UserProfileDto> PatchAsync(int userId, PatchUserProfileRequest request, CancellationToken cancellationToken);
    Task<UserProfileDto> UpdateActivityAsync(int userId, UpdateActivityRequest request, CancellationToken cancellationToken);
}
