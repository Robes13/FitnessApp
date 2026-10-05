using System.Text;
using System.Text.Json.Serialization;
using FitnessApp.Api.Data;
using FitnessApp.Api.Domain.Entities;
using FitnessApp.Api.Exceptions;
using FitnessApp.Api.Options;
using FitnessApp.Api.Services.Achievements;
using FitnessApp.Api.Services.Auth;
using FitnessApp.Api.Services.Consent;
using FitnessApp.Api.Services.Devices;
using FitnessApp.Api.Services.FoodLogs;
using FitnessApp.Api.Services.Export;
using FitnessApp.Api.Services.Foods;
using FitnessApp.Api.Services.Goals;
using FitnessApp.Api.Services.History;
using FitnessApp.Api.Services.Meals;
using FitnessApp.Api.Services.Metadata;
using FitnessApp.Api.Services.Nutrition;
using FitnessApp.Api.Services.Notifications;
using FitnessApp.Api.Services.Profiles;
using FitnessApp.Api.Services.Reminders;
using FitnessApp.Api.Services.Settings;
using FitnessApp.Api.Services.Weights;
using FitnessApp.Api.Utilities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using AppDataProtectionOptions = FitnessApp.Api.Options.DataProtectionOptions;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: false);

// Neon's "Copy snippet" wraps the .NET string in quotes; tolerate them when pasted as-is.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")?.Trim().Trim('"');
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is required in appsettings.json.");
}

var jwtOptions = builder.Configuration
    .GetSection(JwtOptions.SectionName)
    .Get<JwtOptions>()
    ?? throw new InvalidOperationException("The Jwt configuration section is required.");

if (string.IsNullOrWhiteSpace(jwtOptions.SigningKey) || jwtOptions.SigningKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:SigningKey is required and must contain at least 32 characters.");
}

builder.Services.AddOptions<JwtOptions>().Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(value => !string.IsNullOrWhiteSpace(value.Issuer) && !string.IsNullOrWhiteSpace(value.Audience)
        && value.SigningKey.Length >= 32 && value.AccessTokenMinutes > 0,
        "Jwt issuer, audience, signing key, and positive access lifetime are required.").ValidateOnStart();
builder.Services.AddOptions<RefreshTokenOptions>().Bind(builder.Configuration.GetSection(RefreshTokenOptions.SectionName))
    .Validate(value => value.LifetimeDays > 0, "RefreshTokens:LifetimeDays must be positive.").ValidateOnStart();
builder.Services.AddOptions<AzureBlobStorageOptions>().Bind(builder.Configuration.GetSection(AzureBlobStorageOptions.SectionName))
    .Validate(value => Uri.TryCreate(value.ContainerUrl, UriKind.Absolute, out var uri)
        && uri.Scheme == Uri.UriSchemeHttps
        && uri.AbsolutePath.Trim('/') == value.ContainerName
        && !string.IsNullOrWhiteSpace(value.ContainerName)
        && !string.IsNullOrWhiteSpace(value.SasToken),
        "AzureBlobStorage requires a valid HTTPS container URL, matching container name, and SAS token.")
    .ValidateOnStart();
builder.Services.AddOptions<ProfileImageOptions>().Bind(builder.Configuration.GetSection(ProfileImageOptions.SectionName))
    .Validate(value => value.MaximumFileSizeBytes > 0 && value.AllowedContentTypes.Length > 0,
        "ProfileImages maximum size and allowed content types are required.").ValidateOnStart();
builder.Services.AddOptions<AppOptions>().Bind(builder.Configuration.GetSection(AppOptions.SectionName))
    .Validate(value => Uri.TryCreate(value.PublicBaseUrl, UriKind.Absolute, out var uri)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps),
        "App:PublicBaseUrl must be an absolute http(s) URL.").ValidateOnStart();
builder.Services.AddOptions<SmtpOptions>().Bind(builder.Configuration.GetSection(SmtpOptions.SectionName));
builder.Services.AddOptions<FirebaseOptions>().Bind(builder.Configuration.GetSection(FirebaseOptions.SectionName));
builder.Services.AddOptions<AppDataProtectionOptions>().Bind(builder.Configuration.GetSection(AppDataProtectionOptions.SectionName));
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddMemoryCache();
var dataProtection = builder.Services.AddDataProtection();
var keyPath = builder.Configuration.GetSection(AppDataProtectionOptions.SectionName).Get<AppDataProtectionOptions>()?.KeysPath;
if (!string.IsNullOrWhiteSpace(keyPath))
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keyPath));

builder.Services.AddDbContext<FitnessAppDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddHealthChecks();
if (OperatingSystem.IsWindows())
    builder.Logging.AddFilter<Microsoft.Extensions.Logging.EventLog.EventLogLoggerProvider>(null, LogLevel.None);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                if (context.Principal?.FindFirst("token_type")?.Value != "access"
                    || !int.TryParse(context.Principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
                        out var userId))
                {
                    context.Fail("Invalid access token.");
                    return;
                }

                var database = context.HttpContext.RequestServices.GetRequiredService<FitnessAppDbContext>();
                var active = await database.Users.AsNoTracking().AnyAsync(user => user.UserId == userId
                    && user.IsActive && user.EmailVerifiedAt != null && user.DeletedAt == null,
                    context.HttpContext.RequestAborted);
                if (!active) context.Fail("The account is not active.");
            }
        };
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddHttpClient("Resend", client => client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddScoped<FitnessApp.Api.Services.Email.IEmailService, FitnessApp.Api.Services.Email.SmtpEmailService>();
builder.Services.AddScoped<IAccountMessageSender, AccountMessageSender>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserAccountService, UserAccountService>();
builder.Services.AddScoped<IUserDataExportService, UserDataExportService>();
builder.Services.AddScoped<IConsentService, ConsentService>();
builder.Services.AddScoped<IUserDeviceService, UserDeviceService>();
builder.Services.AddSingleton<IPushNotificationService, FirebasePushNotificationService>();
if (!string.IsNullOrWhiteSpace(builder.Configuration.GetSection(FirebaseOptions.SectionName).Get<FirebaseOptions>()?.ProjectId))
    builder.Services.AddHostedService<ReminderNotificationWorker>();
builder.Services.AddScoped<IUserProfileService, UserProfileService>();
builder.Services.AddScoped<IProfileImageService, ProfileImageService>();
if (builder.Environment.IsDevelopment())
    builder.Services.AddSingleton<IProfileImageStorage, LocalProfileImageStorage>();
else
    builder.Services.AddSingleton<IProfileImageStorage, AzureBlobProfileImageStorage>();
builder.Services.AddScoped<IUserGoalService, UserGoalService>();
builder.Services.AddScoped<IHistoryService, HistoryService>();
builder.Services.AddScoped<IFoodService, FoodService>();
builder.Services.AddScoped<IFoodLogService, FoodLogService>();
builder.Services.AddScoped<INutritionService, NutritionService>();
builder.Services.AddScoped<IWeightLogService, WeightLogService>();
builder.Services.AddScoped<IMealCollectionService, MealCollectionService>();
builder.Services.AddSingleton<MetadataService>();
builder.Services.AddScoped<IReminderService, ReminderService>();
builder.Services.AddScoped<IUserSettingService, UserSettingService>();
builder.Services.AddScoped<IAchievementService, AchievementService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FitnessApp API",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter the access JWT."
    });

    options.OperationFilter<SwaggerAuthorizationOperationFilter>();
});

var app = builder.Build();

if (app.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var database = scope.ServiceProvider.GetRequiredService<FitnessAppDbContext>();
    database.Database.Migrate();
    if (app.Configuration.GetValue<bool>("Database:SeedFoodCatalog"))
    {
        var added = FoodCatalogSeeder.Seed(database, app.Environment.ContentRootPath, DateTime.UtcNow);
        app.Logger.LogInformation("Food catalogue: {Added} foods added.", added);
    }
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    var devImages = Directory.CreateDirectory(Path.Combine(app.Environment.ContentRootPath, LocalProfileImageStorage.FolderName));
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(devImages.FullName),
        RequestPath = "/api/v1/dev-images"
    });
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
