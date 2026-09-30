using System.Net;

namespace FitnessApp.Api.Services.Auth;

public static class VerificationEmailTemplate
{
    public static (string Html, string Text) Create(string url)
    {
        var safeUrl = WebUtility.HtmlEncode(url);
        return ($"""
            <!doctype html><html lang="en"><body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;color:#173c32">
            <h1>Nutrify</h1><h2>Verify your email address</h2>
            <p>Please verify your email address to activate your Nutrify account. This link expires in 24 hours.</p>
            <p><a href="{safeUrl}" style="display:inline-block;padding:16px 24px;background:#176b50;color:white;border-radius:8px">Verify email</a></p>
            <p>If the button does not work, copy this full URL into your browser:</p><p><a href="{safeUrl}">{safeUrl}</a></p>
            <p>If you did not request this email, you can ignore it.</p></body></html>
            """, $"Nutrify\n\nPlease verify your email address to activate your Nutrify account.\n\nVerify email: {url}\n\nThis link expires in 24 hours. If you did not request this email, you can ignore it.");
    }
}
