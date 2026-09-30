namespace FitnessApp.Api.Services.Auth;

public interface IAccountMessageSender
{
    Task SendVerificationAsync(string email, string token, CancellationToken cancellationToken);
    Task SendAsync(string email, string subject, string message, CancellationToken cancellationToken);
}
