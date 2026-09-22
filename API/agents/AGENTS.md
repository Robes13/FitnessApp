# AGENTS.md

## Purpose

This file defines the coding and database standards for the FitnessApp .NET Web API.

When making changes:

1. Inspect the existing project structure and follow the established patterns.
2. Prefer simple, maintainable solutions over unnecessary abstractions.
3. Do not introduce a new framework, library, architectural pattern, or naming style without a clear reason.
4. Keep changes focused on the requested task.
5. Do not rewrite working code merely to apply a personal preference.

---

# 1. C# Naming Conventions

Follow standard Microsoft C# naming conventions.

## Types and public members

Use `PascalCase` for:

- Classes
- Interfaces
- Records
- Enums
- Enum members
- Methods
- Public properties
- Constants

Examples:

```csharp
public class FoodService
{
    public async Task<FoodDto?> GetFoodAsync(int foodId)
    {
        // ...
    }
}
```

Interfaces use an `I` prefix:

```csharp
public interface IFoodService
{
}
```

## Local variables and parameters

Use `camelCase`:

```csharp
public async Task<FoodDto?> GetFoodAsync(int foodId)
{
    var food = await GetFoodFromDatabaseAsync(foodId);

    return food;
}
```

## Private fields

Use `_camelCase`:

```csharp
private readonly IFoodService _foodService;
private readonly ILogger<FoodService> _logger;
```

## Constants

Use `PascalCase`:

```csharp
private const int MaximumFoodNameLength = 100;
```

Avoid unnecessary abbreviations.

Prefer:

```text
userId
foodId
foodLogId
completionRequirement
```

over:

```text
uid
fid
req
```

---

# 2. Entity, DTO and Record Conventions

## Entities

Database entities are normal C# classes and use singular `PascalCase` names:

```csharp
public class User
{
}

public class FoodLog
{
}

public class MealCollection
{
}
```

Entity properties also use `PascalCase`:

```csharp
public int UserId { get; set; }
public DateTime CreatedAt { get; set; }
```

## DTOs

Every DTO must have its **own file**.

Do not place multiple DTOs in one file.

DTOs must be declared as **records**, not classes.

Use clear names describing their API purpose:

```text
UserDto.cs
CreateFoodLogRequest.cs
UpdateFoodLogRequest.cs
FoodLogDto.cs
DashboardDto.cs
```

Example:

```csharp
public record FoodLogDto(
    int FoodLogId,
    int FoodId,
    decimal Quantity,
    decimal CaloriesConsumed);
```

Request and response DTOs should contain only the data required by the API operation.

Do not expose EF Core entities directly from controllers.

---

# 3. API Architecture

Keep responsibilities separated:

```text
Controller
    ↓
Service
    ↓
Entity Framework Core
    ↓
PostgreSQL
```

## Controllers

Controllers are responsible for:

- HTTP communication
- Route definitions
- Receiving request DTOs
- Returning appropriate HTTP responses
- Calling services

Controllers should not contain substantial business logic or large database queries.

## Services

Services contain:

- Business logic
- Calculations
- Business validation
- Coordination between entities and repositories/data access

Use dependency injection.

Do not manually instantiate services with `new`.

## Data access

Use Entity Framework Core for database access.

Keep database queries out of controllers.

---

# 4. Async Code

Use `async`/`await` for database, network and other I/O operations.

Prefer:

```csharp
var food = await _context.Foods
    .FirstOrDefaultAsync(
        food => food.FoodId == foodId,
        cancellationToken);
```

Do not use blocking calls such as:

```csharp
.Result
.Wait()
```

Use `CancellationToken` for request-based asynchronous operations where appropriate.

---

# 5. DTO and Entity Separation

EF Core entities must not be returned directly from API endpoints.

Use:

```text
HTTP Request
    ↓
Request DTO
    ↓
Controller
    ↓
Service
    ↓
Entity
    ↓
Database
```

and:

```text
Database
    ↓
Entity
    ↓
Service
    ↓
Response DTO
    ↓
Controller
    ↓
HTTP Response
```

This prevents database structure from becoming part of the public API contract.

---

# 6. Validation

Validate incoming data at the API even when the Angular/Ionic application already performs client-side validation.

Client-side validation improves user experience.

API validation protects the application.

Use:

```text
Angular/Ionic
    ↓
Pre-validation
    ↓
.NET API
    ↓
Post-validation
    ↓
Business logic
    ↓
Database
```

Never trust values solely because they came from the frontend.

---

# 7. HTTP Status Codes

Use appropriate HTTP status codes.

| Situation | Status |
|---|---|
| Successful request | `200 OK` |
| Resource created | `201 Created` |
| Successful delete/no response body | `204 No Content` |
| Invalid request | `400 Bad Request` |
| Not authenticated | `401 Unauthorized` |
| Not authorized | `403 Forbidden` |
| Resource not found | `404 Not Found` |
| Conflict | `409 Conflict` |
| Unexpected server error | `500 Internal Server Error` |

Do not return `200 OK` for every situation.

---

# 8. Authentication and Authorization

Use the configured JWT authentication and authorization system.

Do not manually parse or validate JWTs inside every controller.

Protected endpoints should use authorization attributes/policies where appropriate:

```csharp
[Authorize]
[HttpGet]
public async Task<IActionResult> GetDashboard()
{
    // ...
}
```

The application uses:

- Short-lived access JWT
- Refresh token
- Refresh token persistence in PostgreSQL

Never log:

- Passwords
- Password hashes
- JWTs
- Refresh tokens
- Password reset codes
- Email verification tokens

---

# 9. Logging

Use `ILogger<T>` for application logging.

Prefer structured logging:

```csharp
_logger.LogInformation(
    "Food log {FoodLogId} was created for user {UserId}",
    foodLogId,
    userId);
```

Do not use interpolated strings for structured log messages.

Logging should support the application's console and persistent database logging.

Use appropriate log levels:

```text
Information → Normal successful operations
Warning     → Rejected or unusual operations
Error       → Failed operations and exceptions
Debug       → Detailed development information
```

Do not automatically serialize complete request objects into logs.

Log only explicitly approved/safe values.

Avoid logging unnecessary personal or health information.

---

# 10. Exception Handling

Use centralized exception handling for unexpected API errors.

Do not add repetitive `try/catch` blocks to every controller method.

If an exception is caught for a specific reason, log it appropriately and either handle it or rethrow it.

Never silently swallow exceptions.

Bad:

```csharp
try
{
    // ...
}
catch
{
}
```

---

# 11. Dependency Injection

Use ASP.NET Core dependency injection.

Prefer constructor injection:

```csharp
public class FoodController : ControllerBase
{
    private readonly IFoodService _foodService;

    public FoodController(IFoodService foodService)
    {
        _foodService = foodService;
    }
}
```

Do not manually construct services that should be provided by dependency injection.

---

# 12. Configuration and Secrets

Do not hard-code:

- Database passwords
- JWT secrets
- API keys
- Connection strings containing credentials
- Environment-specific URLs

Use the ASP.NET Core configuration system and appropriate environment variables/secrets.

Never commit secrets to Git.

---

# 13. PostgreSQL Naming Conventions

The PostgreSQL schema should follow the naming used by the project's Entity Framework Core model and `DbContext`.

## Tables

Use the project's established table naming convention consistently.

For this project, database tables are represented in the ER model using uppercase singular entity names, for example:

```text
USER
USER_PROFILE
USER_GOAL
FOOD
FOOD_LOG
MEAL_COLLECTION
MEAL_ITEM
WEIGHT_LOG
USER_SETTING
USER_ACHIEVEMENT
```

Do not introduce a mixture of naming styles such as:

```text
User
user_profile
FOOD_LOGS
foodLogs
```

When configuring table names explicitly in the EF Core `DbContext`, keep the mapping consistent with the existing schema.

## Columns

Use `PascalCase` names matching the C# entity properties when this is the established convention in the project:

```text
UserId
CreatedAt
FoodId
FoodLogId
CompletionRequirement
```

Do not randomly mix:

```text
user_id
UserID
userid
UserId
```

Use the existing `DbContext` mappings as the source of truth for the actual database naming.

## Primary keys

Primary keys follow the entity name plus `Id`:

```text
UserId
FoodId
FoodLogId
MealCollectionId
WeightLogId
```

## Foreign keys

Foreign keys use the same name as the primary key they reference:

```text
UserId
FoodId
MealTypeId
UnitId
AchievementType
```

Do not invent alternative names such as:

```text
UserReference
UserIDForeign
FoodReferenceId
```

## Unique constraints

Use unique constraints where a value must be unique.

Examples:

```text
USER.Email
USER.Username
```

For user settings, the combination should be unique:

```text
(UserId, SettingKey)
```

This allows every user to have one value for each setting.

## NOT NULL

Use `NOT NULL` for values that are required by the domain.

Optional values should be nullable in both the database model and C# model where appropriate.

## Foreign keys

Relationships between entities should be represented with foreign keys.

Do not rely only on application code to maintain relational integrity.

## Indexes

Add indexes to fields that are frequently used for:

- Lookups
- Filtering
- Sorting
- Foreign-key queries

Do not add indexes without a reason, because indexes also add overhead when data is inserted or changed.

---

# 14. Entity Framework Core and DbContext

The project's `DbContext` is the central mapping between the C# model and PostgreSQL.

When adding or changing an entity:

1. Update the entity class.
2. Update the `DbContext` when required.
3. Configure relationships and constraints explicitly when they are not obvious from conventions.
4. Keep table and column naming consistent with the existing mappings.
5. Create an EF Core migration.
6. Review the generated migration before applying it.

Use `DbSet<T>` properties with C# `PascalCase` names.

Example:

```csharp
public DbSet<User> Users { get; set; }
public DbSet<Food> Foods { get; set; }
public DbSet<FoodLog> FoodLogs { get; set; }
```

The C# `DbSet` property name is not automatically the same thing as the PostgreSQL table name. Explicit table mappings in the `DbContext` take precedence where the project defines them.

Do not rename existing database tables or columns merely to match a personal preference. Check the current `DbContext` configuration and migrations first.

---

# 15. EF Core Migrations

Database structure changes must be made through EF Core migrations.

Do not manually modify the database schema for changes that should be represented in the application's migration history.

Before creating a migration:

- Check the entity changes.
- Check relationships.
- Check nullable/required properties.
- Check indexes and unique constraints.
- Check table/column names.

Review generated migrations before applying them.

---

# 16. Enums and Fixed Application Values

Use backend enums for values that are fixed and defined by the application.

Do not create a database lookup table for every fixed application concept.

Examples include:

```csharp
public enum AchievementType
{
    FirstMeal,
    TenMeals,
    TenWeights
}
```

For achievements, metadata is defined through attributes:

```csharp
public enum AchievementType
{
    [StringValue("First Meal")]
    [CompletionRequirement(1)]
    FirstMeal,

    [StringValue("Ten Meals")]
    [CompletionRequirement(10)]
    TenMeals,

    [StringValue("Ten Weights")]
    [CompletionRequirement(10)]
    TenWeights
}
```

`CompletionRequirement` is not required to be unique. Multiple achievements may have the same completion requirement.

The database should store user-specific achievement progress, not duplicate the static achievement definition.

---

# 17. User Settings

User settings are dynamic user-specific data and are stored in the database.

The setting key is defined by a backend enum:

```csharp
public enum UserSettingType
{
    Theme,
    Notifications,
    MealReminders,
    WeightReminders,
    Language,
    WeightUnit
}
```

The database uses a `USER_SETTING` table containing the user's setting value.

The combination of:

```text
UserId + SettingKey
```

must be unique.

Do not create a database table containing all possible setting types when those setting types are already defined by the backend enum.

---

# 18. Achievement Progress

Achievements are defined in the backend using `AchievementType` and its attributes.

The database stores user progress in `USER_ACHIEVEMENT`.

Conceptually:

```text
AchievementType
    ↓
Static achievement definition
    ↓
USER_ACHIEVEMENT
    ↓
User-specific progress
```

Example:

```text
UserId: 15
AchievementType: TenMeals
Progress: 7
CompletedAt: NULL
```

The application reads the completion requirement from the enum attribute rather than storing the same static requirement in the database.

---

# 19. General Code Quality

Before considering a change complete:

- Code should compile.
- Nullable warnings should not be ignored without a reason.
- Existing functionality should not be unnecessarily changed.
- Avoid duplicate business logic.
- Avoid unnecessarily large methods.
- Use meaningful names.
- Prefer simple solutions.
- Remove unused usings and variables.
- Do not leave debugging code such as `Console.WriteLine` in production application code.
- Use `ILogger` for application logging.
- Do not introduce dead code.

When changing existing code, preserve the existing architecture unless there is a clear reason to improve it.

---

# 20. Before Creating New Code

Before adding a new class, service, DTO, entity, enum, or database table:

1. Search the project for an existing implementation.
2. Check whether an existing service or model can be reused.
3. Check the `DbContext` and existing EF Core configurations.
4. Follow the existing naming convention.
5. Check whether the requested functionality belongs in a controller, service, entity, DTO, or database model.
6. Keep the change as small as reasonably possible.

Do not create abstractions simply because they are theoretically possible.

---

# 21. Definition of Done

A backend change is considered complete when:

- It follows these naming and architecture conventions.
- DTOs are separate record files.
- Validation exists where required.
- Authentication/authorization is handled consistently.
- Database changes are represented through EF Core migrations.
- No sensitive information is logged.
- Appropriate HTTP status codes are returned.
- The project builds successfully.
- Relevant tests are updated or added where applicable.
- No unnecessary architectural changes were introduced.
