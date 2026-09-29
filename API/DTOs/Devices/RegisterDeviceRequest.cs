using System.ComponentModel.DataAnnotations;
using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Devices;

public sealed record RegisterDeviceRequest(
    [Required, MinLength(20), MaxLength(4096)] string Token,
    PushPlatform Platform);
