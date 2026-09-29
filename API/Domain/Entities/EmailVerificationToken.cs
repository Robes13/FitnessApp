namespace FitnessApp.Api.Domain.Entities;

public class EmailVerificationToken
{
    public int EmailVerificationTokenId { get; set; }
    public int UserId { get; set; }
    public required string TokenHash { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UsedAt { get; set; }
    public User User { get; set; } = null!;
}
