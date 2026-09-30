namespace FitnessApp.Api.Services.Email;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string html, string text, CancellationToken cancellationToken);
}
