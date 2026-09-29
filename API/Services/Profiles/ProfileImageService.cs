using FitnessApp.Api.Data;
using FitnessApp.Api.DTOs.Profile;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Services.Profiles;

public sealed class ProfileImageService(
    FitnessAppDbContext context,
    IProfileImageStorage storage,
    IOptions<ProfileImageOptions> options,
    ILogger<ProfileImageService> logger) : IProfileImageService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IProfileImageStorage _storage = storage;
    private readonly ProfileImageOptions _options = options.Value;
    private readonly ILogger<ProfileImageService> _logger = logger;

    public async Task<ProfileImageDto> UploadAsync(int userId, IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length <= 0 || file.Length > _options.MaximumFileSizeBytes)
            throw new BusinessValidationException("Image size is outside the configured limit.");
        using var stream = new MemoryStream();
        await file.CopyToAsync(stream, cancellationToken);
        var content = stream.ToArray();
        var extension = DetectExtension(content)
            ?? throw new BusinessValidationException("Only JPEG, PNG, and WebP images are supported.");
        var contentType = extension switch
        {
            "jpg" => "image/jpeg",
            "png" => "image/png",
            _ => "image/webp"
        };
        if (!string.Equals(file.ContentType, contentType, StringComparison.OrdinalIgnoreCase)
            || !_options.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            throw new BusinessValidationException("Image content type does not match an allowed image format.");

        var profile = await _context.UserProfiles.SingleOrDefaultAsync(candidate => candidate.UserId == userId,
            cancellationToken) ?? throw new NotFoundException("Profile not found.");
        var oldKey = profile.ProfileImagePath;
        var newKey = await _storage.SaveAsync(content, contentType, cancellationToken);
        try
        {
            profile.ProfileImagePath = newKey;
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            try { await _storage.DeleteAsync(newKey, CancellationToken.None); }
            catch (Exception exception) { _logger.LogWarning("New profile image blob cleanup failed: {ErrorType}", exception.GetType().Name); }
            throw;
        }
        if (oldKey is not null)
        {
            try { await _storage.DeleteAsync(oldKey, CancellationToken.None); }
            catch (Exception exception) { _logger.LogWarning("Old profile image blob cleanup failed: {ErrorType}", exception.GetType().Name); }
        }
        return new ProfileImageDto(_storage.GetUrl(newKey));
    }

    public async Task<string> GetUrlAsync(int userId, CancellationToken cancellationToken)
    {
        var key = await _context.UserProfiles.AsNoTracking().Where(profile => profile.UserId == userId)
            .Select(profile => profile.ProfileImagePath).SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Profile image not found.");
        return _storage.GetUrl(key);
    }

    public async Task DeleteAsync(int userId, CancellationToken cancellationToken)
    {
        var profile = await _context.UserProfiles.SingleOrDefaultAsync(candidate => candidate.UserId == userId,
            cancellationToken) ?? throw new NotFoundException("Profile not found.");
        if (profile.ProfileImagePath is null) throw new NotFoundException("Profile image not found.");
        var key = profile.ProfileImagePath;
        profile.ProfileImagePath = null;
        await _context.SaveChangesAsync(cancellationToken);
        await _storage.DeleteAsync(key, cancellationToken);
    }

    private static string? DetectExtension(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            return "jpg";
        if (bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(
            new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }))
            return "png";
        if (bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8)
            && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8))
            return "webp";
        return null;
    }
}
