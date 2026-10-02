using System.Net;

namespace FitnessApp.Api.Utilities;

/// <summary>An account mail: plain text (also the Development outbox file) and the same text as HTML.</summary>
public sealed record AccountEmail(string Subject, string Text, string Html);

public static class AccountEmails
{
    public static AccountEmail Verification(string baseUrl, string token) => Create(
        "Bekræft din e-mail · Confirm your e-mail – Nutrify",
        "Tryk på linket for at bekræfte din e-mail til Nutrify. Linket gælder i 24 timer.",
        "Tap the link to confirm your e-mail for Nutrify. The link is valid for 24 hours.",
        $"{baseUrl.TrimEnd('/')}/api/v1/auth/email/verify?token={token}",
        "Har du ikke oprettet en konto eller skiftet e-mail, kan du ignorere mailen.",
        "If you didn't create an account or change your e-mail, you can ignore this mail.");

    public static AccountEmail PasswordReset(string baseUrl, string token) => Create(
        "Nulstil din adgangskode · Reset your password – Nutrify",
        "Tryk på linket for at vælge en ny adgangskode til Nutrify. Linket gælder i 1 time.",
        "Tap the link to choose a new password for Nutrify. The link is valid for 1 hour.",
        $"{baseUrl.TrimEnd('/')}/api/v1/auth/password/reset?token={token}",
        "Har du ikke bedt om det, kan du ignorere mailen.",
        "If you didn't ask for this, you can ignore this mail.");

    private static AccountEmail Create(string subject, string danish, string english, string link,
        string ignoreDanish, string ignoreEnglish)
    {
        var text = string.Join(Environment.NewLine, danish, english, "", link, "", ignoreDanish, ignoreEnglish);
        var href = WebUtility.HtmlEncode(link);
        var html = "<!doctype html><html lang=\"da\"><head><meta charset=\"utf-8\"></head><body>"
            + Paragraph(danish, english) + $"<p><a href=\"{href}\">{href}</a></p>"
            + Paragraph(ignoreDanish, ignoreEnglish) + "</body></html>";
        return new AccountEmail(subject, text, html);
    }

    private static string Paragraph(string danish, string english)
        => $"<p>{WebUtility.HtmlEncode(danish)}<br><span lang=\"en\">{WebUtility.HtmlEncode(english)}</span></p>";
}
