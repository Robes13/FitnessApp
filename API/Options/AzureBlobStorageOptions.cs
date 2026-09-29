namespace FitnessApp.Api.Options;

public sealed class AzureBlobStorageOptions
{
    public const string SectionName = "AzureBlobStorage";
    public string ContainerUrl { get; init; } = string.Empty;
    public string ContainerName { get; init; } = string.Empty;
    public string SasToken { get; init; } = string.Empty;
    public string PublicBaseUrl { get; init; } = string.Empty;
}
