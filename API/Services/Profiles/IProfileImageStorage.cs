namespace FitnessApp.Api.Services.Profiles;

public interface IProfileImageStorage
{
    Task<string> SaveAsync(byte[] content, string contentType, CancellationToken cancellationToken);
    Task DeleteAsync(string key, CancellationToken cancellationToken);
    string GetUrl(string key);
}
