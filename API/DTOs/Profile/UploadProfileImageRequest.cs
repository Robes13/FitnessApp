using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Profile;

public sealed record UploadProfileImageRequest
{
    [Required]
    public required IFormFile File { get; init; }
}
