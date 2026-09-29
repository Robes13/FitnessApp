using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Consent;
using FitnessApp.Api.DTOs.Common;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Services.Auth;
using Microsoft.EntityFrameworkCore;
using FitnessApp.Api.Utilities;

namespace FitnessApp.Api.Services.Consent;

public sealed class ConsentService(
    FitnessAppDbContext context,
    IUserAccountService accountService,
    TimeProvider timeProvider) : IConsentService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IUserAccountService _accountService = accountService;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<CursorPage<UserConsentDto>> GetAsync(int userId, int limit, string? cursor,
        CancellationToken cancellationToken)
    {
        limit = RequestGuards.NormalizeLimit(limit);
        var query = _context.UserConsents.AsNoTracking().Where(consent => consent.UserId == userId);
        if (!string.IsNullOrWhiteSpace(cursor))
        {
            if (!CursorCodec.TryDecodeId(cursor, out var cursorId))
                throw new BusinessValidationException("The cursor is invalid.");
            query = query.Where(consent => consent.UserConsentId < cursorId);
        }
        var rows = await query.OrderByDescending(consent => consent.UserConsentId)
            .Take(limit + 1).ToListAsync(cancellationToken);
        var hasMore = rows.Count > limit;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        return new CursorPage<UserConsentDto>(rows.Select(consent => new UserConsentDto(
            consent.UserConsentId, consent.ConsentType, consent.DocumentVersion,
            consent.GrantedAt, consent.WithdrawnAt)).ToList(),
            hasMore ? CursorCodec.EncodeId(rows[^1].UserConsentId) : null, hasMore);
    }

    public async Task<UserConsentDto> GrantAsync(int userId, GrantConsentRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.ConsentType) || string.IsNullOrWhiteSpace(request.DocumentVersion)
            || request.DocumentVersion.Length > 50)
            throw new BusinessValidationException("Consent type or document version is invalid.");
        if (await _context.UserConsents.AnyAsync(consent => consent.UserId == userId
            && consent.ConsentType == request.ConsentType && consent.WithdrawnAt == null,
            cancellationToken))
            throw new ConflictException("This consent is already active.");
        var consent = new UserConsent
        {
            UserId = userId,
            ConsentType = request.ConsentType,
            DocumentVersion = request.DocumentVersion.Trim(),
            GrantedAt = _timeProvider.GetUtcNow().UtcDateTime
        };
        _context.UserConsents.Add(consent);
        await _context.SaveChangesAsync(cancellationToken);
        return new UserConsentDto(consent.UserConsentId, consent.ConsentType,
            consent.DocumentVersion, consent.GrantedAt, consent.WithdrawnAt);
    }

    public async Task WithdrawAsync(int userId, ConsentType type, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(type)) throw new BusinessValidationException("Consent type is invalid.");
        var consent = await _context.UserConsents
            .Where(candidate => candidate.UserId == userId && candidate.ConsentType == type
                && candidate.WithdrawnAt == null)
            .OrderByDescending(candidate => candidate.GrantedAt)
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Active consent not found.");

        if (type is ConsentType.Terms or ConsentType.HealthDataProcessing)
        {
            await _accountService.SoftDeleteAsync(userId, cancellationToken);
            return;
        }

        consent.WithdrawnAt = _timeProvider.GetUtcNow().UtcDateTime;
        var setting = await _context.UserSettings.SingleOrDefaultAsync(candidate => candidate.UserId == userId
            && candidate.SettingKey == SettingKey.AllowStepsSharing, cancellationToken);
        if (setting is not null)
        {
            setting.SettingValue = "false";
            setting.UpdatedAt = consent.WithdrawnAt.Value;
        }
        await _context.SaveChangesAsync(cancellationToken);
    }
}
