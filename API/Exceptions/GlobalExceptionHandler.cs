using Microsoft.EntityFrameworkCore;
using Npgsql;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace FitnessApp.Api.Exceptions;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger = logger;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (statusCode, title) = exception switch
        {
            DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation, ConstraintName: "IX_USER_NormalizedUsername" or "IX_USER_Username" } } => (StatusCodes.Status409Conflict, "That username is already in use."),
            NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            WeightDateConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            BusinessValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, "Forbidden"),
            ExternalServiceConfigurationException => (StatusCodes.Status503ServiceUnavailable, "Service unavailable"),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected server error")
        };

        if (statusCode >= 500)
        {
            _logger.LogError(exception, "Unhandled exception for {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            _logger.LogWarning("Request failed with {StatusCode}: {Message}", statusCode, exception is DbUpdateException ? title : exception.Message);
        }

        httpContext.Response.StatusCode = statusCode;
        var problem = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception is DbUpdateException ? (statusCode == 409 ? title : "An unexpected error occurred.")
                : exception is ExternalServiceConfigurationException
                ? exception.Message
                : statusCode >= 500 ? "An unexpected error occurred." : exception.Message
        };
        if (exception is WeightDateConflictException weightConflict)
            problem.Extensions["existingWeightLogId"] = weightConflict.ExistingWeightLogId;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);

        return true;
    }
}
