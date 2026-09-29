using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class RefreshToken
{
    public required string TokenId { get; set; }
    public int UserId { get; set; }
    public TokenState State { get; set; }

    public User User { get; set; } = null!;
}
