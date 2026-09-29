namespace FitnessApp.Api.Services.Auth;

public interface IAccountMessageSender
{
    Task SendAsync(string email, string subject, string message, CancellationToken cancellationToken);
}
