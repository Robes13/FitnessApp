namespace FitnessApp.Api.DTOs.Common;

public sealed record CursorPage<T>(
    IReadOnlyList<T> Items,
    string? NextCursor,
    bool HasMore);
