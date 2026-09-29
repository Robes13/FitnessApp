using System.Text.Json;

namespace FitnessApp.Api.Domain.Entities;

public class LogEntry
{
    public long LogEntryId { get; set; }
    public int UserId { get; set; }
    public string? MethodName { get; set; }
    public required string Message { get; set; }
    public JsonDocument? Parameters { get; set; }
    public string? Exception { get; set; }
    public string? RequestPath { get; set; }
    public string? HttpMethod { get; set; }
    public string? CorrelationId { get; set; }
    public DateTime CreatedAt { get; set; }

    public User User { get; set; } = null!;
}
