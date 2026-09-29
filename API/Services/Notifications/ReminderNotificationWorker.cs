using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Notifications;

public sealed class ReminderNotificationWorker(
    IServiceScopeFactory scopeFactory,
    IPushNotificationService pushService,
    TimeProvider timeProvider,
    ILogger<ReminderNotificationWorker> logger) : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
    private readonly IPushNotificationService _pushService = pushService;
    private readonly TimeProvider _timeProvider = timeProvider;
    private readonly ILogger<ReminderNotificationWorker> _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                await ProcessAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogWarning("Reminder scan failed ({ErrorType})", exception.GetType().Name);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task ProcessAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<FitnessAppDbContext>();
        var now = _timeProvider.GetUtcNow().UtcDateTime;
        var reminders = await database.Reminders.AsNoTracking()
            .Where(reminder => reminder.IsEnabled && reminder.User.IsActive
                && reminder.User.DeletedAt == null && reminder.User.UserProfile != null)
            .Select(reminder => new
            {
                reminder.ReminderId,
                reminder.UserId,
                reminder.ReminderType,
                reminder.ReminderTime,
                TimeZoneId = reminder.User.UserProfile!.TimeZoneId
            }).ToListAsync(cancellationToken);
        var userIds = reminders.Select(reminder => reminder.UserId).Distinct().ToArray();
        var settings = await database.UserSettings.AsNoTracking()
            .Where(setting => userIds.Contains(setting.UserId))
            .Select(setting => new { setting.UserId, setting.SettingKey, setting.SettingValue })
            .ToListAsync(cancellationToken);

        foreach (var reminder in reminders)
        {
            if (settings.Any(setting => setting.UserId == reminder.UserId
                && setting.SettingValue.Equals("false", StringComparison.OrdinalIgnoreCase)
                && (setting.SettingKey == SettingKey.Notifications
                    || reminder.ReminderType == ReminderType.LogFood
                        && setting.SettingKey == SettingKey.MealReminders
                    || reminder.ReminderType == ReminderType.LogWeight
                        && setting.SettingKey == SettingKey.WeightReminders)))
                continue;

            try
            {
                var zone = TimeZoneInfo.FindSystemTimeZoneById(reminder.TimeZoneId);
                var localToday = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(now, zone));
                foreach (var date in new[] { localToday.AddDays(-1), localToday })
                {
                    var localScheduled = date.ToDateTime(reminder.ReminderTime, DateTimeKind.Unspecified);
                    if (zone.IsInvalidTime(localScheduled)) continue;
                    var scheduledFor = TimeZoneInfo.ConvertTimeToUtc(localScheduled, zone);
                    if (scheduledFor > now || scheduledFor <= now.AddDays(-1)) continue;
                    var claimId = await ClaimAsync(database, reminder.ReminderId, scheduledFor, now,
                        cancellationToken);
                    if (claimId is null) continue;

                    var title = reminder.ReminderType == ReminderType.LogWeight
                        ? "Weight reminder" : "Food reminder";
                    var body = reminder.ReminderType == ReminderType.LogWeight
                        ? "Record your weight when you're ready." : "Log your food when you're ready.";
                    if (await _pushService.SendAsync(reminder.UserId, title, body, cancellationToken))
                    {
                        await database.ReminderDeliveries.Where(delivery => delivery.ReminderId == reminder.ReminderId
                            && delivery.ScheduledFor == scheduledFor && delivery.ClaimId == claimId.Value)
                            .ExecuteUpdateAsync(setters => setters.SetProperty(delivery => delivery.SentAt, now),
                                cancellationToken);
                    }
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogWarning("Reminder {ReminderId} processing failed ({ErrorType})",
                    reminder.ReminderId, exception.GetType().Name);
            }
        }
    }

    private static async Task<Guid?> ClaimAsync(FitnessAppDbContext database, int reminderId,
        DateTime scheduledFor, DateTime now, CancellationToken cancellationToken)
    {
        var claimId = Guid.NewGuid();
        var claimedUntil = now.AddMinutes(5);
        var inserted = await database.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO \"REMINDER_DELIVERY\" (\"ReminderId\", \"ScheduledFor\", \"ClaimId\", \"ClaimedUntil\") VALUES ({reminderId}, {scheduledFor}, {claimId}, {claimedUntil}) ON CONFLICT (\"ReminderId\", \"ScheduledFor\") DO NOTHING",
            cancellationToken);
        if (inserted == 1) return claimId;
        var reclaimed = await database.ReminderDeliveries
            .Where(delivery => delivery.ReminderId == reminderId
                && delivery.ScheduledFor == scheduledFor && delivery.SentAt == null
                && delivery.ClaimedUntil <= now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(delivery => delivery.ClaimId, claimId)
                .SetProperty(delivery => delivery.ClaimedUntil, claimedUntil), cancellationToken);
        return reclaimed == 1 ? claimId : null;
    }
}
