using System.Net;
using FitnessApp.Api.Options;
using FitnessApp.Api.Services.Email;
using FitnessApp.Api.Exceptions;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Services.Auth;

public sealed class AccountMessageSender(IEmailService emailService, IOptions<SmtpOptions> options,
    ILogger<AccountMessageSender> logger) : IAccountMessageSender
{
    public Task SendAsync(string email, string subject, string message, CancellationToken cancellationToken)
        => emailService.SendEmailAsync(email, subject, $"<p>{WebUtility.HtmlEncode(message)}</p>", message, cancellationToken);

    public async Task SendVerificationAsync(string email, string token, CancellationToken cancellationToken)
    {
        try
        {
            if (options.Value.ApplicationUrl != "https://eldorado-fts.dk")
                throw new ExternalServiceConfigurationException("The Nutrify application URL must be https://eldorado-fts.dk.");
            var url = options.Value.ApplicationUrl + "/api/v1/auth/email/verify?token=" + Uri.EscapeDataString(token);
            var (html, text) = VerificationEmailTemplate.Create(url);
            await emailService.SendEmailAsync(email, "Verify your Nutrify email", html, text, cancellationToken);
        }
        catch (ExternalServiceConfigurationException exception)
        {
            // Account and token are already committed. Keep registration successful and allow a later resend.
            logger.LogWarning("Verification email not delivered: {Reason}", exception.Message);
        }
    }
}
