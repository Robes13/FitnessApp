namespace FitnessApp.Api.Services.Notifications;

public interface IPushNotificationService
{
    Task<bool> SendAsync(int userId, string title, string body, CancellationToken cancellationToken);
}
