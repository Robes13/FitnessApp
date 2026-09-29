using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.DTOs.Consent;

public sealed record GrantConsentRequest(ConsentType ConsentType, string DocumentVersion);
