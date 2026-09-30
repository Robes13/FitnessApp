namespace FitnessApp.Api.Utilities;

public static class AccountEmails
{
    public static (string Subject, string Body) Verification(string baseUrl, string token) => (
        "Bekræft din e-mail · Confirm your e-mail – Nutrify",
        Body("Tryk på linket for at bekræfte din e-mail til Nutrify. Linket gælder i 24 timer.",
            "Tap the link to confirm your e-mail for Nutrify. The link is valid for 24 hours.",
            $"{baseUrl.TrimEnd('/')}/api/v1/auth/email/verify?token={token}",
            "Har du ikke oprettet en konto eller skiftet e-mail, kan du ignorere mailen.",
            "If you didn't create an account or change your e-mail, you can ignore this mail."));

    public static (string Subject, string Body) PasswordReset(string baseUrl, string token) => (
        "Nulstil din adgangskode · Reset your password – Nutrify",
        Body("Tryk på linket for at vælge en ny adgangskode til Nutrify. Linket gælder i 1 time.",
            "Tap the link to choose a new password for Nutrify. The link is valid for 1 hour.",
            $"{baseUrl.TrimEnd('/')}/api/v1/auth/password/reset?token={token}",
            "Har du ikke bedt om det, kan du ignorere mailen.",
            "If you didn't ask for this, you can ignore this mail."));

    private static string Body(string danish, string english, string link, string ignoreDanish, string ignoreEnglish)
        => string.Join(Environment.NewLine, danish, english, "", link, "", ignoreDanish, ignoreEnglish);
}
