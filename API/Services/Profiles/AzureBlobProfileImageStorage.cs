using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using FitnessApp.Api.Options;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Services.Profiles;

public sealed class AzureBlobProfileImageStorage : IProfileImageStorage
{
    private readonly AzureBlobStorageOptions _options;
    private readonly BlobContainerClient _container;

    public AzureBlobProfileImageStorage(IOptions<AzureBlobStorageOptions> options)
    {
        _options = options.Value;
        var sas = _options.SasToken.TrimStart('?');
        _container = new BlobContainerClient(new Uri($"{_options.ContainerUrl.TrimEnd('/')}?{sas}"));
    }

    public static string CreateBlobName(string contentType) =>
        $"{Guid.NewGuid():N}{ExtensionFor(contentType)}";

    public async Task<string> SaveAsync(byte[] content, string contentType, CancellationToken cancellationToken)
    {
        var blobName = CreateBlobName(contentType);
        using var stream = new MemoryStream(content, writable: false);
        await _container.GetBlobClient(blobName).UploadAsync(stream,
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType } },
            cancellationToken);
        return blobName;
    }

    public async Task DeleteAsync(string key, CancellationToken cancellationToken)
    {
        ValidateKey(key);
        await _container.GetBlobClient(key).DeleteIfExistsAsync(cancellationToken: cancellationToken);
    }

    public string GetUrl(string key)
    {
        ValidateKey(key);
        var baseUrl = string.IsNullOrWhiteSpace(_options.PublicBaseUrl)
            ? _options.ContainerUrl : _options.PublicBaseUrl;
        return $"{baseUrl.TrimEnd('/')}/{Uri.EscapeDataString(key)}?{_options.SasToken.TrimStart('?')}";
    }

    private static string ExtensionFor(string contentType) => contentType switch
    {
        "image/jpeg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        _ => throw new ArgumentException("Unsupported image content type.", nameof(contentType))
    };

    private static void ValidateKey(string key)
    {
        if (key.Length is < 36 or > 37 || !Guid.TryParseExact(key[..32], "N", out _)
            || key[32..] is not (".jpg" or ".png" or ".webp"))
            throw new ArgumentException("Invalid image key.", nameof(key));
    }
}
