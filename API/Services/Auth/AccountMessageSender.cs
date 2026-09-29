using System.Net;
using System.Net.Mail;
using FitnessApp.Api.Options;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Services.Auth;

public sealed class AccountMessageSender(
    IOptions<SmtpOptions> options,
    IHostEnvironment environment) : IAccountMessageSender
{
    private readonly SmtpOptions _options = options.Value;
    private readonly IHostEnvironment _environment = environment;

    public async Task SendAsync(string email, string subject, string message, CancellationToken cancellationToken)
    {
        if (_environment.IsDevelopment())
        {
            var directory = Path.Combine(_environment.ContentRootPath, ".dev-outbox");
            Directory.CreateDirectory(directory);
            var filename = Path.Combine(directory, $"{Guid.NewGuid():N}.txt");
            await File.WriteAllTextAsync(filename,
                $"To: {email}{Environment.NewLine}Subject: {subject}{Environment.NewLine}{Environment.NewLine}{message}",
                cancellationToken);
            return;
        }

        var host = _options.Host;
        var from = _options.From;
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
        {
            throw new InvalidOperationException("Smtp:Host and Smtp:From must be configured for account email delivery.");
        }

        using var client = new SmtpClient(host, _options.Port)
        {
            EnableSsl = _options.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network
        };
        var username = _options.Username;
        if (!string.IsNullOrWhiteSpace(username))
        {
            client.Credentials = new NetworkCredential(username, _options.Password);
        }

        using var mail = new MailMessage(from, email, subject, message);
        await client.SendMailAsync(mail, cancellationToken);
    }
}
