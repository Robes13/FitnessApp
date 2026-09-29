namespace FitnessApp.Api.Options;

public sealed class ProfileImageOptions
{
    public const string SectionName = "ProfileImages";
    public long MaximumFileSizeBytes { get; init; }
    public string[] AllowedContentTypes { get; init; } = [];
}
