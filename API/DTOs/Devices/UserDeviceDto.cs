using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Devices;

public sealed record UserDeviceDto(int UserDeviceId, PushPlatform Platform, DateTime RegisteredAt);
