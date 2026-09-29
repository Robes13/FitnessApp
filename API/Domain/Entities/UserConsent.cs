using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Domain.Entities;

public class UserConsent
{
    public int UserConsentId { get; set; }
    public int UserId { get; set; }
    public ConsentType ConsentType { get; set; }
    public required string DocumentVersion { get; set; }
    public DateTime GrantedAt { get; set; }
    public DateTime? WithdrawnAt { get; set; }
    public User User { get; set; } = null!;
}
