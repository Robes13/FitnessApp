using FitnessApp.Api.DTOs.Auth;

namespace FitnessApp.Api.Services.Auth;

public interface IUserAccountService
{
    Task<UserDto> GetAsync(int userId, CancellationToken cancellationToken);
    Task<UserDto> UpdateAsync(int userId, UpdateAccountRequest request, CancellationToken cancellationToken);
    Task SoftDeleteAsync(int userId, CancellationToken cancellationToken);
}
