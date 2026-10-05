using System.Net.Http.Json;
using System.Net.Mail;
using System.Net.Http.Headers;
using System.Text.Json;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Services.Email;

public sealed class SmtpEmailService(IOptions<SmtpOptions> options, IHttpClientFactory clients) : IEmailService
{
    public async Task SendEmailAsync(string to, string subject, string html, string text, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        try
        {
            if (settings.Host != "smtp.resend.com" || settings.Port != 587 || !settings.EnableSsl
                || settings.From != "nutrify@eldorado-fts.dk" || settings.DisplayName != "Nutrify"
                || settings.Username != "resend" || string.IsNullOrWhiteSpace(settings.Password))
                throw new ExternalServiceConfigurationException("Resend SMTP configuration is incomplete.");

            // Fail closed: never substitute a sender when domain authorization cannot be confirmed.
            string? after = null;
            var verified = false;
            using var http = clients.CreateClient("Resend");
            do
            {
                var url = "https://api.resend.com/domains?limit=100" + (after is null ? "" : "&after=" + Uri.EscapeDataString(after));
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.Password);
                using var response = await http.SendAsync(request, cancellationToken);
                if (!response.IsSuccessStatusCode)
                    throw new ExternalServiceConfigurationException("Unable to confirm Resend domain authorization. Check domain verification and API key domain-read permissions.");
                using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                var domains = document.RootElement.GetProperty("data").EnumerateArray().ToArray();
                verified = domains.Any(domain => domain.GetProperty("name").GetString() == "eldorado-fts.dk"
                    && domain.GetProperty("status").GetString() == "verified");
                after = document.RootElement.TryGetProperty("has_more", out var more) && more.GetBoolean() && domains.Length > 0
                    ? domains[^1].GetProperty("id").GetString() : null;
            } while (!verified && after is not null);
            if (!verified)
                throw new ExternalServiceConfigurationException("Verify eldorado-fts.dk in Resend before sending email.");

            // Resend's HTTPS API instead of SMTP: hosts such as Render's free tier block outbound port 587.
            using var send = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
            {
                Content = JsonContent.Create(new
                {
                    from = new MailAddress(settings.From, settings.DisplayName).ToString(),
                    to = new[] { new MailAddress(to).Address },
                    subject,
                    html,
                    text
                })
            };
            send.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.Password);
            using var sent = await http.SendAsync(send, cancellationToken);
            sent.EnsureSuccessStatusCode();
        }
        catch (ExternalServiceConfigurationException) { throw; }
        catch (Exception)
        {
            // Do not retain provider responses or inner exceptions: they may contain credentials or message content.
            throw new ExternalServiceConfigurationException("Email delivery is temporarily unavailable. Please request another verification email later.");
        }
    }
}
