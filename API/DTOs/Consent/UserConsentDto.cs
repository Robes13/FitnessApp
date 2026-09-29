using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Consent;

public sealed record UserConsentDto(
    int UserConsentId,
    ConsentType ConsentType,
    string DocumentVersion,
    DateTime GrantedAt,
    DateTime? WithdrawnAt);
