using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using FitnessApp.Api.Data;
using Google.Apis.Auth.OAuth2;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using FitnessApp.Api.Options;
using Microsoft.Extensions.Options;

namespace FitnessApp.Api.Services.Notifications;

public sealed class FirebasePushNotificationService(
    IServiceScopeFactory scopeFactory,
    IDataProtectionProvider protectionProvider,
    IOptions<FirebaseOptions> options,
    ILogger<FirebasePushNotificationService> logger) : IPushNotificationService
{
    private readonly IServiceScopeFactory _scopeFactory = scopeFactory;
    private readonly IDataProtector _protector = protectionProvider.CreateProtector("FitnessApp.DeviceToken.v1");
    private readonly FirebaseOptions _options = options.Value;
    private readonly ILogger<FirebasePushNotificationService> _logger = logger;
    private FirebaseMessaging? _messaging;
    private readonly object _lock = new();

    public async Task<bool> SendAsync(int userId, string title, string body, CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<FitnessAppDbContext>();
        var devices = await database.UserDevices.AsNoTracking().Where(device => device.UserId == userId)
            .Select(device => device.ProtectedToken).ToListAsync(cancellationToken);
        if (devices.Count == 0) return false;

        var allSent = true;
        foreach (var protectedToken in devices)
        {
            try
            {
                var token = _protector.Unprotect(protectedToken);
                // Ionic clients currently register FCM tokens. Firebase 3.7 marks this
                // property obsolete while FID-based client registration is rolling out.
#pragma warning disable CS0618
                var message = new Message
                {
                    Token = token,
                    Notification = new Notification { Title = title, Body = body }
                };
#pragma warning restore CS0618
                await GetMessaging().SendAsync(message, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                allSent = false;
                _logger.LogWarning("Push delivery failed for user {UserId} ({ErrorType})",
                    userId, exception.GetType().Name);
            }
        }
        return allSent;
    }

    private FirebaseMessaging GetMessaging()
    {
        if (_messaging is not null) return _messaging;
        lock (_lock)
        {
            if (_messaging is not null) return _messaging;
            var projectId = _options.ProjectId;
            if (string.IsNullOrWhiteSpace(projectId))
                throw new InvalidOperationException("Firebase:ProjectId is not configured.");
            var app = FirebaseApp.GetInstance("FitnessApp.Api")
                ?? FirebaseApp.Create(new AppOptions
                {
                    Credential = GoogleCredential.GetApplicationDefault(),
                    ProjectId = projectId
                }, "FitnessApp.Api");
            _messaging = FirebaseMessaging.GetMessaging(app);
            return _messaging;
        }
    }
}
