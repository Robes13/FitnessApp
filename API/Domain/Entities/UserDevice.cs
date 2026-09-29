using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class UserDevice
{
    public int UserDeviceId { get; set; }
    public int UserId { get; set; }
    public required string TokenHash { get; set; }
    public required string ProtectedToken { get; set; }
    public PushPlatform Platform { get; set; }
    public DateTime RegisteredAt { get; set; }
    public User User { get; set; } = null!;
}
