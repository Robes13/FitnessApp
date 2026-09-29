using System.ComponentModel.DataAnnotations;

namespace FitnessApp.Api.DTOs.Settings;

public sealed record UpsertUserSettingRequest
{
    [Required, MaxLength(500)]
    public required string Value { get; init; }
}
