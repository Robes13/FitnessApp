using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Email;
using FitnessApp.Api.Utilities;

namespace FitnessApp.Api.Services.Auth;

public sealed class AccountMessageSender(
    IEmailService emailService,
    IHostEnvironment environment,
    ILogger<AccountMessageSender> logger) : IAccountMessageSender
{
    public async Task SendAsync(string email, AccountEmail mail, CancellationToken cancellationToken)
    {
        if (environment.IsDevelopment())
        {
            var directory = Path.Combine(environment.ContentRootPath, ".dev-outbox");
            Directory.CreateDirectory(directory);
            var filename = Path.Combine(directory, $"{Guid.NewGuid():N}.txt");
            await File.WriteAllTextAsync(filename,
                $"To: {email}{Environment.NewLine}Subject: {mail.Subject}{Environment.NewLine}{Environment.NewLine}{mail.Text}",
                cancellationToken);
            return;
        }

        try
        {
            await emailService.SendEmailAsync(email, mail.Subject, mail.Html, mail.Text, cancellationToken);
        }
        catch (ExternalServiceConfigurationException exception)
        {
            // The account change is already committed and every mail can be asked for again (resend, forgot,
            // PATCH me). Failing here would also tell an anonymous caller that the account exists.
            logger.LogWarning("Account email not delivered: {Reason}", exception.Message);
        }
    }
}
