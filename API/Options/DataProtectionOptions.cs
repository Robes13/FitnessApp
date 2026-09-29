namespace FitnessApp.Api.Options;

public sealed class DataProtectionOptions
{
    public const string SectionName = "DataProtection";
    public string KeysPath { get; init; } = string.Empty;
}
