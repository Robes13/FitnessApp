namespace FitnessApp.Api.Services.Profiles;

// ponytail: Development-only stand-in for Azure Blob (like .dev-outbox) so the photo flow is testable locally
public sealed class LocalProfileImageStorage(IHostEnvironment environment) : IProfileImageStorage
{
    public const string FolderName = ".dev-images";
    private readonly string _directory = Path.Combine(environment.ContentRootPath, FolderName);

    public async Task<string> SaveAsync(byte[] content, string contentType, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        var key = AzureBlobProfileImageStorage.CreateBlobName(contentType);
        await File.WriteAllBytesAsync(Path.Combine(_directory, key), content, cancellationToken);
        return key;
    }

    public Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        var path = Path.Combine(_directory, Path.GetFileName(key));
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public string GetUrl(string key) => $"/api/v1/dev-images/{Uri.EscapeDataString(key)}";
}
