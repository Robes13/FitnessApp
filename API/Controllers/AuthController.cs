using System.Net;
using FitnessApp.Api.DTOs.Auth;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Extensions;
using FitnessApp.Api.Services.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    private const string InvalidLinkTitle = "Ugyldigt link · Invalid link";
    private const string PageCss = "body{margin:0;padding:24px 16px;font-family:system-ui,sans-serif;line-height:1.5;"
        + "background:#f4f5f7;color:#1b1f24}main{max-width:28rem;margin:0 auto;padding:24px;border-radius:12px;"
        + "background:#fff}h1{margin:0 0 12px;font-size:1.4rem}label{display:block;margin-top:16px;font-weight:600}"
        + "input{box-sizing:border-box;width:100%;margin-top:4px;padding:10px;font-size:1rem;border:1px solid #767f8a;"
        + "border-radius:8px}button{width:100%;margin-top:16px;padding:12px;font-size:1rem;border:0;border-radius:8px;"
        + "background:#1d6b45;color:#fff}.error{color:#b00020;font-weight:600}";
    private readonly IAuthService _authService = authService;

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult<UserDto>> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var response = await _authService.RegisterAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _authService.LoginAsync(request, cancellationToken));
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request, CancellationToken cancellationToken)
    {
        return Ok(await _authService.RefreshAsync(request, cancellationToken));
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshRequest request, CancellationToken cancellationToken)
    {
        await _authService.LogoutAsync(User.GetUserId(), request.RefreshToken, cancellationToken);
        return NoContent();
    }

    [Authorize]
    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll(CancellationToken cancellationToken)
    {
        await _authService.LogoutAllAsync(User.GetUserId(), cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("email/verify")]
    public async Task<IActionResult> VerifyEmail(VerifyEmailRequest request, CancellationToken cancellationToken)
    {
        await _authService.VerifyEmailAsync(request, cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("email/verify")]
    public async Task<ContentResult> VerifyEmailLink([FromQuery] string? token, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(token))
        {
            try
            {
                await _authService.VerifyEmailAsync(new VerifyEmailRequest(token), cancellationToken);
                return HtmlPage(StatusCodes.Status200OK, "E-mail bekræftet · E-mail confirmed",
                    "Din e-mail er bekræftet. Gå tilbage til Nutrify-appen.",
                    "Your e-mail is confirmed. Go back to the Nutrify app.");
            }
            catch (BusinessValidationException)
            {
                // Falls through to the invalid-link page: a browser needs HTML, not problem JSON.
            }
        }

        return HtmlPage(StatusCodes.Status400BadRequest, InvalidLinkTitle,
            "Linket er ugyldigt, udløbet eller allerede brugt. Tryk på 'Send mail igen' i appen, eller log ind, "
                + "hvis din e-mail allerede er bekræftet. Skiftede du e-mail? Skift den igen under Profil.",
            "The link is invalid, expired or already used. Tap 'Send e-mail again' in the app, or log in "
                + "if your e-mail is already confirmed. Changed your e-mail? Change it again under Profile.");
    }

    [AllowAnonymous]
    [HttpPost("email/resend-verification")]
    public async Task<IActionResult> ResendVerification(ResendVerificationRequest request, CancellationToken cancellationToken)
    {
        await _authService.ResendVerificationAsync(request, cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("password/forgot")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        await _authService.ForgotPasswordAsync(request, cancellationToken);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpGet("password/reset")]
    public async Task<ContentResult> ResetPasswordForm([FromQuery] string? token, CancellationToken cancellationToken)
        => !string.IsNullOrWhiteSpace(token)
            && await _authService.IsPasswordResetTokenActiveAsync(token, cancellationToken)
                ? ResetFormPage(StatusCodes.Status200OK, token, null)
                : InvalidResetLinkPage();

    [AllowAnonymous]
    [HttpPost("password/reset")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<ContentResult> ResetPassword([FromForm] string? token, [FromForm] string? newPassword,
        [FromForm] string? newPasswordConfirmation, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
            return InvalidResetLinkPage();
        newPassword ??= string.Empty;
        if (newPassword != newPasswordConfirmation)
            return ResetFormPage(StatusCodes.Status400BadRequest, token,
                "Adgangskoderne er ikke ens · The passwords do not match");
        if (newPassword.Length is < 10 or > 200)
            return ResetFormPage(StatusCodes.Status400BadRequest, token,
                "Adgangskoden skal være 10–200 tegn · The password must be 10–200 characters");

        try
        {
            await _authService.ResetPasswordAsync(
                new ResetPasswordRequest(token, newPassword, newPassword), cancellationToken);
        }
        catch (BusinessValidationException)
        {
            return InvalidResetLinkPage();
        }

        return HtmlPage(StatusCodes.Status200OK, "Adgangskode skiftet · Password changed",
            "Din adgangskode er skiftet. Gå tilbage til Nutrify, og log ind.",
            "Your password has been changed. Go back to Nutrify and log in.");
    }

    [Authorize]
    [HttpPost("password/change")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        await _authService.ChangePasswordAsync(User.GetUserId(), request, cancellationToken);
        return NoContent();
    }

    private ContentResult InvalidResetLinkPage() => HtmlPage(StatusCodes.Status400BadRequest, InvalidLinkTitle,
        "Linket er ugyldigt, udløbet eller allerede brugt. Bed om et nyt under 'Glemt adgangskode' i appen.",
        "The link is invalid, expired or already used. Ask for a new one under 'Forgot password' in the app.");

    private ContentResult ResetFormPage(int statusCode, string token, string? error)
    {
        var errorHtml = error is null ? string.Empty : $"<p class=\"error\" role=\"alert\">{error}</p>";
        return HtmlPage(statusCode, "Ny adgangskode · New password",
            "Vælg en ny adgangskode til Nutrify.", "Choose a new password for Nutrify.",
            errorHtml
            + "<form method=\"post\" action=\"reset\">"
            + $"<input type=\"hidden\" name=\"token\" value=\"{WebUtility.HtmlEncode(token)}\">"
            + "<label for=\"newPassword\">Ny adgangskode · New password</label>"
            + "<input id=\"newPassword\" name=\"newPassword\" type=\"password\" required minlength=\"10\" "
            + "maxlength=\"200\" autocomplete=\"new-password\" aria-describedby=\"passwordHint\">"
            + "<label for=\"newPasswordConfirmation\">Gentag adgangskode · Repeat password</label>"
            + "<input id=\"newPasswordConfirmation\" name=\"newPasswordConfirmation\" type=\"password\" required "
            + "minlength=\"10\" maxlength=\"200\" autocomplete=\"new-password\">"
            + "<p id=\"passwordHint\">Mindst 10 tegn · At least 10 characters</p>"
            + "<button type=\"submit\">Gem · Save</button></form>");
    }

    // Title and paragraphs are trusted constants; every echoed (request) value must be HTML-encoded by the caller.
    private ContentResult HtmlPage(int statusCode, string title, string danish, string english, string extraHtml = "")
    {
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        Response.Headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; "
            + "form-action 'self'; base-uri 'none'; frame-ancestors 'none'";
        var html = "<!doctype html><html lang=\"da\"><head><meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
            + $"<title>{title}</title><style>{PageCss}</style></head><body><main><h1>{title}</h1>"
            + $"<p>{danish}</p><p lang=\"en\">{english}</p>{extraHtml}</main></body></html>";
        return new ContentResult { Content = html, ContentType = "text/html; charset=utf-8", StatusCode = statusCode };
    }
}
