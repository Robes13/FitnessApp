using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.DTOs.Devices;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Utilities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace FitnessApp.Api.Services.Devices;

public sealed class UserDeviceService(
    FitnessAppDbContext context,
    IDataProtectionProvider protectionProvider,
    TimeProvider timeProvider) : IUserDeviceService
{
    private readonly FitnessAppDbContext _context = context;
    private readonly IDataProtector _protector = protectionProvider.CreateProtector("FitnessApp.DeviceToken.v1");
    private readonly TimeProvider _timeProvider = timeProvider;

    public async Task<IReadOnlyList<UserDeviceDto>> GetAsync(int userId, CancellationToken cancellationToken)
        => await _context.UserDevices.AsNoTracking().Where(device => device.UserId == userId)
            .OrderByDescending(device => device.RegisteredAt)
            .Select(device => new UserDeviceDto(device.UserDeviceId, device.Platform, device.RegisteredAt))
            .Take(10).ToListAsync(cancellationToken);

    public async Task<UserDeviceDto> RegisterAsync(int userId, RegisterDeviceRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Platform) || request.Token.Length is < 20 or > 4096)
            throw new BusinessValidationException("Device platform or token is invalid.");
        var hash = SecretToken.Hash(request.Token);
        var device = await _context.UserDevices.SingleOrDefaultAsync(candidate => candidate.TokenHash == hash,
            cancellationToken);
        if (device is null)
        {
            if (await _context.UserDevices.CountAsync(candidate => candidate.UserId == userId,
                cancellationToken) >= 10)
                throw new ConflictException("At most 10 devices can be registered.");
            device = new UserDevice
            {
                UserId = userId,
                TokenHash = hash,
                ProtectedToken = _protector.Protect(request.Token),
                Platform = request.Platform,
                RegisteredAt = _timeProvider.GetUtcNow().UtcDateTime
            };
            _context.UserDevices.Add(device);
        }
        else
        {
            // A device changing accounts must stop receiving the previous account's notifications.
            device.UserId = userId;
            device.ProtectedToken = _protector.Protect(request.Token);
            device.Platform = request.Platform;
            device.RegisteredAt = _timeProvider.GetUtcNow().UtcDateTime;
        }
        await _context.SaveChangesAsync(cancellationToken);
        return new UserDeviceDto(device.UserDeviceId, device.Platform, device.RegisteredAt);
    }

    public async Task DeleteAsync(int userId, int deviceId, CancellationToken cancellationToken)
    {
        var device = await _context.UserDevices.SingleOrDefaultAsync(candidate => candidate.UserId == userId
            && candidate.UserDeviceId == deviceId, cancellationToken)
            ?? throw new NotFoundException("Device not found.");
        _context.UserDevices.Remove(device);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
