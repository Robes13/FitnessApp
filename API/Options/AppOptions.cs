namespace FitnessApp.Api.Options;

public sealed class AppOptions
{
    public const string SectionName = "App";
    public string PublicBaseUrl { get; init; } = string.Empty;
}
