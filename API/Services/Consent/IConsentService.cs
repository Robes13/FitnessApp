using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Consent;
using FitnessApp.Api.DTOs.Common;

namespace FitnessApp.Api.Services.Consent;

public interface IConsentService
{
    Task<CursorPage<UserConsentDto>> GetAsync(int userId, int limit, string? cursor,
        CancellationToken cancellationToken);
    Task<UserConsentDto> GrantAsync(int userId, GrantConsentRequest request, CancellationToken cancellationToken);
    Task WithdrawAsync(int userId, ConsentType type, CancellationToken cancellationToken);
}
