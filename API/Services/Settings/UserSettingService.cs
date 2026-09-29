using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.DTOs.Settings;
using FitnessApp.Api.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Settings;

public sealed class UserSettingService(FitnessAppDbContext context, TimeProvider timeProvider) : IUserSettingService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<IReadOnlyList<UserSettingDto>> GetAllAsync(int userId, CancellationToken cancellationToken)
    {
        return await _context.UserSettings
            .AsNoTracking()
            .Where(setting => setting.UserId == userId)
            .OrderBy(setting => setting.SettingKey)
            .Select(setting => new UserSettingDto(setting.SettingKey, setting.SettingValue, setting.UpdatedAt))
            .ToListAsync(cancellationToken);
    }

    public async Task<UserSettingDto?> GetAsync(int userId, SettingKey key, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(key))
        {
            throw new BusinessValidationException("SettingKey is invalid.");
        }

        var setting = await _context.UserSettings.AsNoTracking()
            .SingleOrDefaultAsync(setting => setting.UserId == userId && setting.SettingKey == key, cancellationToken);
        return setting is null ? null : ToDto(setting);
    }

    public async Task<UserSettingDto> UpsertAsync(
        int userId, SettingKey key, UpsertUserSettingRequest request, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(key))
        {
            throw new BusinessValidationException("SettingKey is invalid.");
        }
        if (string.IsNullOrWhiteSpace(request.Value))
        {
            throw new BusinessValidationException("Setting value is required.");
        }
        var value = request.Value.Trim();
        if (value.Length > 500)
            throw new BusinessValidationException("Setting value is too long.");
        if (key is SettingKey.Notifications or SettingKey.MealReminders
            or SettingKey.WeightReminders or SettingKey.AllowStepsSharing)
        {
            if (!bool.TryParse(value, out var enabled))
                throw new BusinessValidationException("This setting requires true or false.");
            if (key == SettingKey.AllowStepsSharing && enabled
                && !await _context.UserConsents.AsNoTracking().AnyAsync(consent => consent.UserId == userId
                    && consent.ConsentType == ConsentType.StepsIntegration
                    && consent.WithdrawnAt == null, cancellationToken))
                throw new UnauthorizedAccessException("Steps integration consent is required.");
            value = enabled ? "true" : "false";
        }
        else if (key == SettingKey.Theme && value is not ("light" or "dark" or "system"))
            throw new BusinessValidationException("Theme must be light, dark, or system.");
        else if (key == SettingKey.WeightUnit && value is not ("kg" or "lb"))
            throw new BusinessValidationException("WeightUnit must be kg or lb.");
        else if (key == SettingKey.Language && (value.Length is < 2 or > 20
            || !System.Text.RegularExpressions.Regex.IsMatch(value, "^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$")))
            throw new BusinessValidationException("Language must be a valid language tag.");

        var setting = await _context.UserSettings
            .SingleOrDefaultAsync(setting => setting.UserId == userId && setting.SettingKey == key, cancellationToken);
        if (setting is null)
        {
            setting = new UserSetting { UserId = userId, SettingKey = key, SettingValue = value };
            _context.UserSettings.Add(setting);
        }
        else
        {
            setting.SettingValue = value;
        }

        setting.UpdatedAt = _timeProvider.GetUtcNow().UtcDateTime;
        await _context.SaveChangesAsync(cancellationToken);
        return ToDto(setting);
    }

    public async Task DeleteAsync(int userId, SettingKey key, CancellationToken cancellationToken)
    {
        var setting = await _context.UserSettings
            .SingleOrDefaultAsync(setting => setting.UserId == userId && setting.SettingKey == key, cancellationToken)
            ?? throw new NotFoundException("Setting not found.");
        _context.UserSettings.Remove(setting);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private static UserSettingDto ToDto(UserSetting setting)
        => new(setting.SettingKey, setting.SettingValue, setting.UpdatedAt);
}
