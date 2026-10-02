using FitnessApp.Api.Utilities;

namespace FitnessApp.Api.Services.Auth;

public interface IAccountMessageSender
{
    Task SendAsync(string email, AccountEmail mail, CancellationToken cancellationToken);
}
