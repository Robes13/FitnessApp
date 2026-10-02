# FitnessApp API – cross-cutting contract reference (for the mobile app)

> **Baggrund fra før integrationen.** Beslutningerne står i `../plan-v2.md`, som går forud for denne fil; status i `../README.md`.

Source of truth: `/Users/janick/Documents/GitHub/FitnessApp/API` (ASP.NET Core, .NET 10, EF Core + Npgsql).
Every statement below was read from the C# code; everything marked **(verified)** was also confirmed
live against the dev stack running in Docker at `http://localhost:5210` on 2026-09-30
(throwaway `*-probe-*@example.test` users, soft-deleted again via `DELETE /api/v1/me`).
Probe scripts: `docs/api-integration/probe-auth/flow.py`, `formats.py`, `claims.py`.

---

## 0. TL;DR for implementers

- Base path `/api/v1`. JSON bodies, **camelCase** keys, enums as **PascalCase strings**, all timestamps **UTC with `Z`**.
- Auth: `POST /auth/login {email,password}` → `{accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, user}`.
  Send `Authorization: Bearer <accessToken>`. Access = 15 min, refresh = 30 days, **rotated on every refresh** (old refresh token dies).
- **You get no tokens until the e-mail is verified.** Register → (e-mail with a 64-char hex token) → `POST /auth/email/verify {token}` → login.
- In Development the "e-mail" is a text file in `.dev-outbox/` (in our Docker setup: `docs/api-integration/docker/outbox/`).
- **No CORS** is configured: the browser dev server and the Capacitor WebViews cannot call the API directly. Use the Angular dev-server proxy in the browser and `CapacitorHttp` on native (section 6) until the API team adds CORS.
- Two error body shapes (section 3): validation errors (`errors` map, `application/problem+json`) and business errors (`title/status/detail`, `application/json`). No machine-readable error codes – only English `detail` strings.
- List endpoints use keyset pagination: `?limit=&cursor=` → `{items, nextCursor, hasMore}`, newest first, max 100 per page.
- Migrations are **not** applied automatically; `dotnet` is **not** installed on this Mac → run everything via Docker (section 8).

---

## 1. Transport basics

| Item                   | Value                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL (dev, Docker) | `http://localhost:5210` (container port 8080). Android emulator: `http://10.0.2.2:5210`. Physical device: `http://<Mac LAN IP>:5210` (Docker publishes on `0.0.0.0`). `AllowedHosts: "*"` so any Host header is accepted. |
| Route prefix           | `api/v1/...` (hard-coded in each controller's `[Route]`).                                                                                                                                                                 |
| Auth header            | `Authorization: Bearer <accessToken>` (JWT, HS256). No cookies are ever used.                                                                                                                                             |
| Request content type   | `application/json` for every body in this document.                                                                                                                                                                       |
| Success content type   | `application/json; charset=utf-8`. `204 No Content` responses have no body.                                                                                                                                               |
| Swagger                | Development only: `GET /swagger` (UI) and `GET /swagger/v1/swagger.json`. A copy is at `docs/api-integration/docker/swagger.json`.                                                                                        |
| Health                 | `GET /health` → `200 text/plain` body `Healthy` (no DB check).                                                                                                                                                            |
| HTTPS                  | Not served by the container. `UseHttpsRedirection` finds no HTTPS port and only logs `Failed to determine the https port for redirect.` (verified in container logs) – no redirect happens.                               |

---

## 2. JSON serialization settings

Configured in `Program.cs`: `AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))`.
Nothing else is customised, so MVC's `JsonSerializerDefaults.Web` apply.

| Aspect                      | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Property names (output)     | camelCase (`userId`, `accessTokenExpiresAt`, `emailVerifiedAt`).                                                                                                                                                                                                                                                                                                                                                                                 |
| Property names (input)      | Case-**insensitive** (`Email`, `USERNAME`, `email` all bind – verified). Unknown properties are ignored.                                                                                                                                                                                                                                                                                                                                         |
| Numbers as strings (input)  | Accepted (`"startingWeight": "70.40"` works – verified). Output numbers are always JSON numbers.                                                                                                                                                                                                                                                                                                                                                 |
| Enums (output)              | PascalCase member name: `"Male"`, `"LoseWeight"`, `"Notifications"`, `"FirstMeal"`. `JsonStringEnumConverter` has no naming policy.                                                                                                                                                                                                                                                                                                              |
| Enums (input)               | Names are case-insensitive (`"male"`, `"loseWeight"` work – verified). Integers are also accepted (`"gender": 2` → `Female` – verified). Unknown name → 400 validation error on `$.<prop>`. Undefined integers pass the converter and are normally rejected later by `Enum.IsDefined` in the service.                                                                                                                                            |
| `[StringValue]` attribute   | **Not** used by JSON. It only feeds `AchievementDto.name` (e.g. `"First Meal"`) via `AchievementMetadata`. The wire value of the enum is still `"FirstMeal"`.                                                                                                                                                                                                                                                                                    |
| `DateTime` (output)         | Always UTC with `Z` (all DB columns are `timestamp with time zone`, and in-memory values come from `TimeProvider.GetUtcNow().UtcDateTime`). Fraction length **varies 0–7 digits**: `"2026-09-29T06:00:00Z"`, `"2026-09-30T06:27:38.539146Z"` (from DB, µs), `"2026-09-30T06:27:38.4847627Z"` (freshly created, 100 ns) – all verified. Parse leniently (check it on iOS WKWebView; if needed, cut the fraction to 3 digits before `new Date()`). |
| `DateTime` (input)          | ISO 8601. With `Z` or an offset → converted to UTC correctly (`+02:00` verified). **Without an offset it is treated as UTC, not local time** (`RequestGuards.NormalizeUtc`; verified `"2026-09-28T08:00:00"` → `"2026-09-28T08:00:00Z"`). Always send `date.toISOString()`.                                                                                                                                                                      |
| `DateTime` in query strings | Same rules. Use the `Z` form: Angular's `HttpParams` does **not** percent-encode `+`, so `+02:00` would reach the server as a space.                                                                                                                                                                                                                                                                                                             |
| `DateOnly`                  | `"yyyy-MM-dd"` both ways (`birthDate`, `recordedDate`, `date`). Route form: `/nutrition/days/2026-09-30`.                                                                                                                                                                                                                                                                                                                                        |
| `TimeOnly`                  | Output `"HH:mm:ss"` (`"07:30:00"`). Input accepts `"07:30"` and `"07:30:00"` (both verified on reminders).                                                                                                                                                                                                                                                                                                                                       |
| `decimal`                   | JSON number that keeps the DB scale: `70.10`, `168.50`, `0.00` (verified). Parse as a number.                                                                                                                                                                                                                                                                                                                                                    |
| Nulls                       | Written explicitly (`"emailVerifiedAt": null`, `"nextCursor": null`, `"profileImageUrl": null`). Nothing is omitted.                                                                                                                                                                                                                                                                                                                             |
| Missing properties (input)  | `required` members (`LoginRequest`, `RefreshRequest`, `RegisterRequest.email/username/password/passwordConfirmation/timeZoneId`) → 400 with key `"$"`. Missing value-type members silently become their default (`0`, `false`, `0001-01-01`, enum value 0 – e.g. a missing `acceptedTerms` gives "Terms must be accepted…").                                                                                                                     |

---

## 3. Error responses

### 3.1 Business errors (thrown exceptions → `Exceptions/GlobalExceptionHandler.cs`)

Content type is **`application/json; charset=utf-8`** (not `problem+json`), and the response carries
`Cache-Control: no-cache,no-store`, `Pragma: no-cache`, `Expires: -1`.
Body = `ProblemDetails` with only `title`, `status`, `detail` (no `type`, `instance`, `traceId`, `errors`):

```json
{ "title": "Unauthorized", "status": 401, "detail": "Invalid email or password." }
```

| Exception                                      | Status | `title`                   | `detail`                                                                                                         |
| ---------------------------------------------- | ------ | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `BusinessValidationException`                  | 400    | `Validation failed`       | exception message                                                                                                |
| `UnauthorizedException`                        | 401    | `Unauthorized`            | exception message                                                                                                |
| `UnauthorizedAccessException`                  | 403    | `Forbidden`               | exception message                                                                                                |
| `NotFoundException`                            | 404    | `Resource not found`      | exception message                                                                                                |
| `ConflictException`                            | 409    | `Conflict`                | exception message                                                                                                |
| `WeightDateConflictException`                  | 409    | `Conflict`                | `A weight entry already exists for this calendar day.` + extra top-level property `"existingWeightLogId": <int>` |
| `ExternalServiceConfigurationException`        | 503    | `Service unavailable`     | exception message (**never thrown anywhere today**)                                                              |
| anything else (incl. SMTP failures, DB errors) | 500    | `Unexpected server error` | always `An unexpected error occurred.`                                                                           |

### 3.2 Model-binding / DataAnnotations errors (`[ApiController]` automatic 400)

Content type **`application/problem+json; charset=utf-8`** (verified):

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Email": ["The Email field is not a valid e-mail address."],
    "Password": ["The field Password must be a string or array type with a minimum length of '10'."]
  },
  "traceId": "00-…-…-00"
}
```

Keys inside `errors` (all verified):

| Cause                                                                          | Key(s)                                                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| DataAnnotations (`[Required]`, `[EmailAddress]`, `[MinLength]`, `[MaxLength]`) | C# property name in **PascalCase**: `Email`, `Username`, `Password`, `NewPassword`, …      |
| Value that can't be converted (bad date, unknown enum name)                    | JSON path `$.birthDate`, `$.gender` **plus** `request: ["The request field is required."]` |
| Missing `required` member                                                      | `$` (message lists the missing camelCase names) + `request`                                |
| Malformed JSON                                                                 | `$` + `request`                                                                            |
| Empty body                                                                     | `""` (`"A non-empty request body is required."`) + `request`                               |

### 3.3 Authentication failures from the JWT middleware

Missing, malformed, tampered or expired access token, a **refresh** token sent as bearer, or a user that is
no longer active / verified / is deleted (`OnTokenValidated` checks `IsActive && EmailVerifiedAt != null && DeletedAt == null` on every request):
**`401`, empty body (`Content-Length: 0`)**, header `WWW-Authenticate: Bearer` (no token) or
`WWW-Authenticate: Bearer error="invalid_token", error_description="…"` (verified). No 403s are produced by the
middleware (there are no roles or policies).

### 3.4 Routing

Unknown route or a failed route constraint (e.g. `/foods/abc` against `{foodId:int}`) → `404`, empty body.
Wrong verb → `405`, empty body, `Allow:` header. `OPTIONS` → `405` (there is no CORS middleware).

### 3.5 Suggested client handling

1. If the body has `errors` → field errors. Match keys case-insensitively, strip a leading `$.`, and ignore `request` / `$` / `""` (show a generic message).
2. Else if the body has `detail` → map `(status, detail)` to an i18n key (catalogue below). Unknown → generic text for that status.
3. Else (empty body) → generic text for that status.
4. **401 handling:** a 401 with an **empty body** on a protected endpoint means the access token is invalid → refresh once (single-flight) and retry. A 401 **with a ProblemDetails body** is a business result (wrong credentials, wrong current password, dead refresh token) → never refresh or retry. A 401 from `/auth/refresh` → clear the session and go to login.

### 3.6 Auth and account `detail` catalogue (exact strings)

| Status | `detail`                                                                                                                                                                                                                                                                                                                                               | Where                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 400    | `Password confirmation does not match.`                                                                                                                                                                                                                                                                                                                | register                                                          |
| 400    | `Terms must be accepted to create an account.`                                                                                                                                                                                                                                                                                                         | register                                                          |
| 400    | `Age must be between 13 and 100 years.` / `Height must be between 100 and 250 cm.` / `Starting weight must be between 25 and 400 kg.` / `Daily steps must be between 0 and 100000.` / `Training days must be between 0 and 7.` / `Workout duration must be between 0 and 480 minutes.` / `A profile enum value is invalid.` / `TimeZoneId is invalid.` | register (`ProfileValidation`)                                    |
| 400    | `Weight must be between 25 and 400 kg.` / `Goal type or change pace is invalid.` / `A maintenance goal must use the current weight and zero change pace.` / `Target weight and change pace must match the selected goal.` / `Age must be 13–100 years and height 100–250 cm.` / `Training intensity is invalid.`                                       | register (`GoalCalculator`)                                       |
| 409    | `An account with that email already exists.`                                                                                                                                                                                                                                                                                                           | register, PATCH /me                                               |
| 409    | `That username is already in use.`                                                                                                                                                                                                                                                                                                                     | register, PATCH /me                                               |
| 401    | `Invalid email or password.`                                                                                                                                                                                                                                                                                                                           | login (**also returned for unverified and deleted accounts**)     |
| 401    | `The refresh token is invalid.` / `The refresh token is invalid or expired.` / `The refresh token is no longer active.`                                                                                                                                                                                                                                | refresh, logout                                                   |
| 401    | `The account is not active.`                                                                                                                                                                                                                                                                                                                           | refresh, password/change                                          |
| 403    | `Refresh token does not belong to the current user.`                                                                                                                                                                                                                                                                                                   | logout                                                            |
| 400    | `The verification token is invalid or expired.`                                                                                                                                                                                                                                                                                                        | email/verify                                                      |
| 400    | `The password reset token is invalid or expired.`                                                                                                                                                                                                                                                                                                      | password/reset                                                    |
| 400    | `Password must be at least 10 characters and match confirmation.`                                                                                                                                                                                                                                                                                      | password/reset, password/change                                   |
| 401    | `Current password is invalid.`                                                                                                                                                                                                                                                                                                                         | password/change (**note: 401 although the access token is fine**) |
| 400    | `Username must contain 3–50 characters.`                                                                                                                                                                                                                                                                                                               | PATCH /me                                                         |
| 404    | `User not found.`                                                                                                                                                                                                                                                                                                                                      | GET/PATCH/DELETE /me, data-export                                 |

---

## 4. Auth flow (`Controllers/AuthController.cs`, `Services/Auth/*`)

### 4.1 Endpoints

| Verb + route                                  | Auth       | Body                                                              | Success                                                    | Errors                                                           |
| --------------------------------------------- | ---------- | ----------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/v1/auth/register`                  | anonymous  | `RegisterRequest` (4.2)                                           | **201** `UserDto` (no `Location` header, **no tokens**)    | 400, 409                                                         |
| `POST /api/v1/auth/login`                     | anonymous  | `{ "email": string, "password": string }`                         | 200 `AuthResponse`                                         | 400 (validation), 401                                            |
| `POST /api/v1/auth/refresh`                   | anonymous  | `{ "refreshToken": string }`                                      | 200 `AuthResponse` (new pair)                              | 400, 401                                                         |
| `POST /api/v1/auth/logout`                    | **Bearer** | `{ "refreshToken": string }`                                      | 204                                                        | 401 (bad JWT / expired access token), 403 (someone else's token) |
| `POST /api/v1/auth/logout-all`                | **Bearer** | none                                                              | 204                                                        | 401                                                              |
| `POST /api/v1/auth/email/verify`              | anonymous  | `{ "token": string }`                                             | 204                                                        | 400                                                              |
| `POST /api/v1/auth/email/resend-verification` | anonymous  | `{ "email": string }`                                             | 204 (always, even for unknown or already verified e-mails) | 400 (invalid e-mail format)                                      |
| `POST /api/v1/auth/password/forgot`           | anonymous  | `{ "email": string }`                                             | 204 (always)                                               | 400 (format)                                                     |
| `POST /api/v1/auth/password/reset`            | anonymous  | `{ "token", "newPassword", "newPasswordConfirmation" }`           | 204                                                        | 400                                                              |
| `POST /api/v1/auth/password/change`           | **Bearer** | `{ "currentPassword", "newPassword", "newPasswordConfirmation" }` | 204                                                        | 400, 401                                                         |

### 4.2 Request / response shapes

```ts
// POST /auth/register – flat body (NOT {password, profile})
interface RegisterRequest {
  email: string; // required, [EmailAddress], ≤320; trimmed + lower-cased server-side
  username: string; // required, 3–50 chars (checked before trim), unique (case-sensitive)
  password: string; // required, 10–200 chars, no complexity rules
  passwordConfirmation: string; // required, must equal password
  birthDate: string; // 'yyyy-MM-dd'; effectively required: age 13–100
  gender: 'Unspecified' | 'Male' | 'Female' | 'Other' | 'PreferNotToSay';
  startingWeight: number; // kg, 25–400
  height: number; // cm, 100–250
  dailySteps: number; // 0–100000
  trainingDaysPerWeek: number; // 0–7
  workoutDurationMinutes: number; // 0–480
  trainingIntensity: 'Low' | 'Moderate' | 'High';
  goalType: 'LoseWeight' | 'MaintainWeight' | 'GainWeight';
  targetWeight?: number | null; // Lose: < startingWeight; Gain: > startingWeight; Maintain: ignored (server uses startingWeight)
  weightChangePerWeek?: number | null; // kg/week, 0 < x ≤ 1 for Lose/Gain; ignored (0) for Maintain
  notificationsEnabled: boolean; // stored as setting Notifications = "true"/"false"
  acceptedTerms: boolean; // must be true
  timeZoneId: string; // required, ≤100, IANA id, e.g. Intl.DateTimeFormat().resolvedOptions().timeZone
}

interface UserDto {
  userId: number;
  email: string;
  username: string;
  isActive: boolean; // false until the e-mail is verified (and again after an e-mail change)
  emailVerifiedAt: string | null; // UTC ISO
  createdAt: string; // UTC ISO
}

interface AuthResponse {
  accessToken: string; // JWT
  accessTokenExpiresAt: string; // UTC ISO, now + Jwt:AccessTokenMinutes (15)
  refreshToken: string; // JWT
  refreshTokenExpiresAt: string; // UTC ISO, now + RefreshTokens:LifetimeDays (30)
  user: UserDto;
}
```

Registration does all of this in one transaction: user (inactive), profile, the first goal (calculated by
`GoalCalculator`), setting `Notifications`, a `Terms` consent stamped with `Consent:TermsVersion` (default `"1"`),
and an e-mail verification token (valid 24 h). It then sends the e-mail **after** the commit.

### 4.3 Login

- Login is **by e-mail only** (`LoginRequest.Email` with `[EmailAddress]`). A username gives
  `400 {"errors":{"Email":["The Email field is not a valid e-mail address."]}}` (verified).
- The e-mail is trimmed and lower-cased, so login is case-insensitive (verified with an upper-cased e-mail).
- Unverified, deactivated and deleted accounts all get the same `401 "Invalid email or password."` (verified).

### 4.4 Tokens, lifetimes and refresh

- Both tokens are HS256 JWTs signed with `Jwt:SigningKey`, `iss` = `FitnessApp.Api`, `aud` = `FitnessApp.Client`, validated with a clock skew of 30 s.
- Access token claims (verified): `sub`, `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier` (userId),
  `email`, `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` (username), `jti`, `token_type: "access"`, `nbf`, `exp`, `iss`, `aud`.
  The refresh token has `sub`, `nameidentifier`, `jti`, `token_type: "refresh"`, `nbf`, `exp`, `iss`, `aud`. You don't need to decode them: `AuthResponse.user` has the data.
- Lifetimes: access 15 min (`Jwt:AccessTokenMinutes`), refresh 30 days (`RefreshTokens:LifetimeDays`).
- Refresh = `POST /auth/refresh` with the refresh token **in the JSON body** (no cookie). The old refresh token's `jti` is atomically flipped `Active → Used`, and a new pair is issued, again valid for 30 days (sliding, no absolute session limit).
- Re-using an old refresh token → `401 "The refresh token is no longer active."` (verified). The token family is **not** revoked on reuse, and there is **no grace period**. Two parallel refreshes with the same token → one of them gets 401. **The client must single-flight refresh.**
- The old access token stays valid until it expires after a refresh (verified). A refresh token can't be used as a bearer (401, verified).
- Recommended: refresh proactively about 60 s before `accessTokenExpiresAt`, plus reactively on an empty-body 401.

### 4.5 Logout

- `logout` needs a **valid access token** and the refresh token in the body. It sets that refresh token to `Revoked`; an unknown `jti` is a silent 204. An invalid JWT → 401 ProblemDetails. A token belonging to another user → 403.
- If the access token has already expired, the call fails with an empty 401. Drop the tokens locally (or refresh first, then log out).
- `logout-all` revokes every active refresh token of the user. Access tokens that were already issued stay valid until they expire (up to 15 min).

### 4.6 E-mail verification and the dev outbox

- Token format: `SecretToken.Create()` = `Convert.ToHexString(RandomNumberGenerator.GetBytes(32))` → **64 upper-case hex characters**. Only its SHA-256 hash is stored.
- Verification tokens are valid **24 h** and are single-use. A resend (or an e-mail change) invalidates every earlier unused token.
- The token is **case- and whitespace-sensitive**: a lower-cased token or one with surrounding spaces → 400 (verified). The client should `trim().toUpperCase()` whatever the user pastes.
- Delivery: plain-text e-mail, **no link or deep link**. Body: `Your verification token is: <TOKEN>`. Subject: `Verify your FitnessApp email`.
- `AccountMessageSender.SendAsync`:
  - **When `ASPNETCORE_ENVIRONMENT=Development`**, SMTP is never used. It writes `Path.Combine(ContentRootPath, ".dev-outbox", $"{Guid.NewGuid():N}.txt")`, whose content is:
    ```
    To: <email>
    Subject: Verify your FitnessApp email

    Your verification token is: 3F9A…(64 hex)
    ```
    `ContentRootPath` is `/app` in the container (our compose mounts `/app/.dev-outbox` → `docs/api-integration/docker/outbox/`) and the `API/` folder under `dotnet run`. `.dev-outbox/` is in the repo `.gitignore`.
    To find a user's token, take the newest `*.txt` whose first line is `To: <email>` and extract `[0-9A-F]{64}`.
  - **Otherwise**, it needs `Smtp:Host` and `Smtp:From` (plus optional `Port` 587, `Username`, `Password`, `EnableSsl` true). If they are missing, it throws `InvalidOperationException` → **500 "An unexpected error occurred."** Because this happens after the DB commit, the user already exists: a retried register → 409, and resend → 500 again (see gaps).
- `POST /auth/email/verify` sets `EmailVerifiedAt`, `IsActive = true` and marks the other open tokens used. A reused token → 400 (verified).
- `resend-verification` is a silent 204 for an unknown, already verified or deleted e-mail (no account enumeration).

### 4.7 Password forgot / reset / change

- `forgot`: only for **active** (verified, non-deleted) users; every other case is a silent 204 with no e-mail. It revokes older active reset tokens and creates a new one (64-hex, valid **1 h**). E-mail subject `Reset your FitnessApp password`, body `Your password reset token is: <TOKEN>` (same outbox mechanism – verified).
- `reset`: `{token, newPassword, newPasswordConfirmation}`. Rules: `newPassword` at least 10 characters, equal to the confirmation, token active and not expired. On success the token is `Used` and **all refresh tokens are revoked** (verified). Access tokens stay valid until they expire (verified). There is **no separate "verify reset code" endpoint**: the token and the new password go in one call.
- `change` (Bearer): same password rules. A wrong current password → **401** `Current password is invalid.` On success all refresh tokens are revoked, so the client must log in again (or keep the current access token until it expires).

### 4.8 Mapping to the app's current stub (`src/app/core/services/auth-api/auth-api.ts`, `session.ts`)

| App today                                                                      | API reality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login(username, password)`                                                    | Needs an **e-mail**. The login form must ask for the e-mail, or the API must add username login (gap).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `register(profile, password)` sends `{password, profile}`                      | A flat `RegisterRequest`. Mapping: `gender` `mand→Male`, `kvinde→Female`, `andet→Other`, `null→Unspecified`. `birthday` (must be set; age 13–100) → `birthDate`. `weightKg→startingWeight`, `heightCm→height`, `stepsPerDay→dailySteps`, `trainingDays` (7 flags) → count of `true` → `trainingDaysPerWeek`, `trainingMinutes→workoutDurationMinutes`, intensity `mildt→Low`, `moderat→Moderate`, `haardt→High`, `goal` `tabe→LoseWeight`, `hold→MaintainWeight`, `tage→GainWeight`, `goalWeightKg→targetWeight`, pace → `weightChangePerWeek` (kg/week, 0 < x ≤ 1), `notificationsEnabled`, plus `passwordConfirmation`, `acceptedTerms: true`, `timeZoneId`. Not accepted: `units` (set the `WeightUnit` setting after login), `kcalOverride`, `photo` (upload after login), which weekdays are training days. |
| `completeSignup()` → logged in but unverified, Home shows a verification sheet | **Not possible**: there are no tokens before verification, and every Bearer call from an unverified user is a 401. The flow must be register → "paste the code from the e-mail" → verify → login (keep the password in memory for that step).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `resendVerification()` (no arguments)                                          | `POST /auth/email/resend-verification {email}`. Keep the sign-up e-mail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `checkVerification()` ("Tjek igen")                                            | No status endpoint. The only probe is attempting login (200 = verified; 401 is ambiguous).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `requestPasswordReset(email)`                                                  | `POST /auth/password/forgot {email}` → 204.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `verifyResetCode(code)`                                                        | No API equivalent. Keep the code client-side (optionally check `^[0-9A-F]{64}$`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `resetPassword(password)`                                                      | `POST /auth/password/reset {token, newPassword, newPasswordConfirmation}` → 204, then login.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `logout()`                                                                     | `POST /auth/logout {refreshToken}` with the Bearer token, then clear local tokens (clear them even if the call fails).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `deleteAccount()`                                                              | `DELETE /api/v1/me` → 204, then clear local data (the TODO in `session.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## 5. `/api/v1/me`, data export, metadata

All `/me` routes need a Bearer token (`[Authorize]` on `MeController`).

| Verb + route                 | Body                                                                                  | Success                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/me`             | –                                                                                     | 200 `UserDto`           | 404 `User not found.` in theory; in practice a deleted user already gets 401 from the middleware.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `PATCH /api/v1/me`           | `{ "email"?: string\|null ([EmailAddress], ≤320), "username"?: string\|null (3–50) }` | 200 `UserDto`           | `{}` is a no-op 200 (verified). Username is trimmed, 3–50 characters, unique → 409. **E-mail change** (compared case-insensitively): 409 if the e-mail is taken; otherwise the account becomes `isActive:false`, `emailVerifiedAt:null`, all refresh tokens are revoked and a new verification token is sent to the **new** address. The 200 response already shows `isActive:false`, and the next Bearer call is a 401. The client must end the session and show "verify the new e-mail, then log in with it". |
| `DELETE /api/v1/me`          | –                                                                                     | 204                     | Irreversible anonymisation, with no password re-check. It deletes food logs, meal collections, the user's own unreferenced foods (referenced ones are renamed `Deleted user food` and lose their barcode), goals, weight logs, reminders, settings, achievements, profile, consents, devices, every token and the log entries. The user row is kept as `deleted-<guid>@invalid.local`. The profile image blob is deleted best-effort. The same access token → 401 afterwards (verified).                        |
| `GET /api/v1/me/data-export` | –                                                                                     | 200 `UserDataExportDto` | Plain JSON (no `Content-Disposition`, not a file). The app has to create the file itself (e.g. Filesystem/Share).                                                                                                                                                                                                                                                                                                                                                                                               |

`UserDataExportDto` (verified live):

```ts
interface UserDataExportDto {
  account: UserDto;
  profile: {
    userProfileId: number;
    userId: number;
    birthDate: string;
    gender: Gender;
    height: number;
    startingWeight: number;
    dailySteps: number;
    trainingDaysPerWeek: number;
    workoutDurationMinutes: number;
    trainingIntensity: TrainingIntensity;
    timeZoneId: string;
    profileImageUrl: string | null; /* includes the SAS query */
  } | null;
  goals: {
    userGoalId: number;
    goalType: GoalType;
    targetWeight: number;
    weightChangePerWeek: number;
    targetDailyCalories: number;
    targetProtein: number;
    targetCarbohydrates: number;
    targetFat: number;
    createdAt: string;
  }[]; // oldest first
  foods: FoodDto[]; // foods created by the user (with servings)
  foodLogs: FoodLogDto[]; // oldest first; NOTE: soft-deleted logs are included and not flagged
  weightLogs: { weightLogId: number; weight: number; recordedAt: string; recordedDate: string }[];
  mealCollections: MealCollectionDto[];
  reminders: {
    reminderId: number;
    reminderType: 'LogFood' | 'LogWeight';
    reminderTime: string;
    isEnabled: boolean;
  }[];
  settings: { settingKey: SettingKey; settingValue: string; updatedAt: string }[];
  achievements: {
    achievementType: AchievementType;
    name: string;
    progress: number;
    completionRequirement: number;
    completedAt: string | null;
  }[];
  consents: {
    userConsentId: number;
    consentType: ConsentType;
    documentVersion: string;
    grantedAt: string;
    withdrawnAt: string | null;
  }[];
}
```

`GET /api/v1/metadata` (anonymous) returns exactly this today (verified); it is `Enum.GetNames` of each enum:

```json
{
  "genders": ["Unspecified", "Male", "Female", "Other", "PreferNotToSay"],
  "trainingIntensities": ["Low", "Moderate", "High"],
  "goalTypes": ["LoseWeight", "MaintainWeight", "GainWeight"],
  "reminderTypes": ["LogFood", "LogWeight"],
  "servingUnits": [
    "Gram",
    "Milliliter",
    "Piece",
    "Slice",
    "Cup",
    "Tablespoon",
    "Teaspoon",
    "Serving"
  ],
  "quantityUnits": [
    "Gram",
    "Milliliter",
    "Piece",
    "Slice",
    "Cup",
    "Tablespoon",
    "Teaspoon",
    "Serving"
  ],
  "settingKeys": [
    "Theme",
    "Notifications",
    "MealReminders",
    "WeightReminders",
    "Language",
    "WeightUnit",
    "AllowStepsSharing"
  ],
  "achievementTypes": ["FirstMeal", "TenMeals", "TenWeights"],
  "consentTypes": ["Terms", "HealthDataProcessing", "StepsIntegration"]
}
```

The endpoint has no labels, numeric values, validation ranges, current terms or consent document version, or setting value formats.
Everything is static, so the app can hard-code these unions as TypeScript types and treat `/metadata` as optional.
(`HistoryEventType` = `AccountCreated|GoalUpdated|FoodLogged|WeightRecorded|AchievementCompleted` and
`PushPlatform` = `Android|Ios` are **not** in the metadata but do appear on the wire.)

---

## 6. CORS and origins

- There is **no CORS at all**: no `AddCors`/`UseCors` anywhere. A preflight `OPTIONS /api/v1/auth/login` with `Origin: http://localhost:4200` → `405 Method Not Allowed`, `Allow: POST`, no `Access-Control-*` headers. A GET with `Origin: capacitor://localhost` → 200 with no `Access-Control-Allow-Origin` (verified).
- Consequences:
  - The browser dev server `http://localhost:4200`: every call fails. JSON POSTs and anything with `Authorization` need a preflight, which gets a 405. Even a simple GET's response can't be read.
  - iOS Capacitor (origin `capacitor://localhost`) and Android Capacitor 8 (default origin `https://localhost`; `http://localhost` with `androidScheme: 'http'`) run fetch/XHR under WebView CORS rules → same failure.
- Workarounds that need no API change:
  1. **Browser dev:** add `proxy.conf.json` (`{"/api": {"target": "http://localhost:5210", "secure": false}}`), wire it into `angular.json` `serve.options.proxyConfig`, and use the relative base URL `/api/v1` in the browser build. There is no proxy config in the repo today.
  2. **Native:** enable `plugins: { CapacitorHttp: { enabled: true } }` in `capacitor.config.ts`. It patches `window.fetch`/`XMLHttpRequest`, which the app's `provideHttpClient(withFetch())` uses, so requests go through the native HTTP stack and CORS doesn't apply. Plain-HTTP dev URLs also need cleartext permission: on Android, `android:usesCleartextTraffic` or a network-security-config (the manifest has neither today); on iOS, an ATS exception (`NSAllowsLocalNetworking` / an exception domain) for LAN IPs. Test this before relying on it.
- The long-term fix is on the API side (see gaps): a CORS policy for `http://localhost:4200`, `capacitor://localhost`, `https://localhost` and `http://localhost`, with methods GET/POST/PUT/PATCH/DELETE and headers `Authorization`, `Content-Type`.

---

## 7. Cursor pagination

Response shape (`DTOs/Common/CursorPage.cs`):

```ts
interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

- Query parameters: `limit` (int; `≤ 0` → the endpoint default; above 100 → clamped to 100 by `RequestGuards.NormalizeLimit`) and `cursor` (the previous page's `nextCursor`, passed back verbatim).
- Keyset pagination, **newest first** (descending timestamp, then descending id). Stop when `hasMore === false` (then `nextCursor === null`). Items created after page 1 was loaded never show up on later pages, so start again from page 1 to refresh.
- `from`/`to` filters (where present): `from` inclusive, `to` exclusive; if both are given and `from >= to` → 400 `'from' must be earlier than 'to'. …`.
- A bad cursor → 400 `The cursor is invalid.` (history: `The history cursor is invalid.`) – verified.
- Cursor encodings (treat them as opaque):
  - `CursorCodec.Encode(ts, id)` = base64url without padding of `"{utcTicks}:{id}"` (e.g. `NjM5MjYyNTg0MDAwMDAwMDAwOjI`).
  - `CursorCodec.EncodeId(id)` = base64url of `"{id}"`.
  - `HistoryService` uses its **own** codec: standard Base64 **with** `=` padding of `"{ticks}:{type}:{id}"` (e.g. `NjM5MjYzNDY1NDQ3NTIwNTgwOjI6OA==`). It works both raw and percent-encoded (verified). The payload alphabet (digits and `:`) never produces `+` or `/`.

| List endpoint                      | Filters                                                                            | Default `limit` | Sort key                           |
| ---------------------------------- | ---------------------------------------------------------------------------------- | --------------- | ---------------------------------- |
| `GET /api/v1/foods`                | `query`, `barcode`, `createdByMe` (bool)                                           | 30              | `FoodId` desc (`EncodeId`)         |
| `GET /api/v1/me/food-logs`         | `from`, `to` (DateTime, optional)                                                  | 50              | `ConsumedAt`, `FoodLogId`          |
| `GET /api/v1/me/weight-logs`       | `from`, `to` (optional)                                                            | 50              | `RecordedAt`, `WeightLogId`        |
| `GET /api/v1/me/goals`             | `from`, `to` (optional)                                                            | 50              | `CreatedAt`, `UserGoalId`          |
| `GET /api/v1/me/meal-collections`  | –                                                                                  | 30              | `CreatedAt`, `MealCollectionId`    |
| `GET /api/v1/me/nutrition/history` | `from`, `to` (**required**)                                                        | 50              | `ConsumedAt`, `FoodLogId`          |
| `GET /api/v1/me/consents`          | –                                                                                  | 50              | `UserConsentId` desc (`EncodeId`)  |
| `GET /api/v1/me/history`           | `from`, `to`, `types` (comma-separated `HistoryEventType` names, case-insensitive) | 50              | `OccurredAt`, type, id (own codec) |

Plain arrays with no pagination: `GET /me/reminders`, `/me/devices` (at most 10), `/me/settings`, `/me/achievements`, `/me/nutrition/days?from=&to=` (DateOnly, 1–32 days, `to` exclusive).

---

## 8. Running the API in Docker

`dotnet` is **not installed** on this Mac (`command not found`), so Docker is the only way to run the API.
The repo has only `API/Dockerfile` (a multi-stage `sdk:10.0` → `aspnet:10.0` build, `USER $APP_UID` (1654), `EXPOSE 8080 8081`, `ENTRYPOINT dotnet API.dll`).
There is no compose file, no auto-migration and no seed data.

### 8.1 Configuration read at startup (`Program.cs`)

| Key (env form)                                                                       | Required?                               | Rule / default                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConnectionStrings__DefaultConnection`                                               | **yes**, throws if empty                | appsettings default `Host=localhost;Port=5432;Database=fitnessapp;Username=fitnessapp;Password=postgres` – inside a container, override `Host`.                                                                                                                                                                                                 |
| `Jwt__Issuer`, `Jwt__Audience`, `Jwt__SigningKey`, `Jwt__AccessTokenMinutes`         | **yes** (throws / `ValidateOnStart`)    | SigningKey at least 32 characters; minutes > 0. All present in `appsettings.json` (the signing key is committed).                                                                                                                                                                                                                               |
| `RefreshTokens__LifetimeDays`                                                        | **yes** (`ValidateOnStart`)             | > 0; appsettings has 30.                                                                                                                                                                                                                                                                                                                        |
| `AzureBlobStorage__ContainerUrl`, `__ContainerName`, `__SasToken`, `__PublicBaseUrl` | **yes** (`ValidateOnStart`)             | ContainerUrl must be absolute **https** and its path must equal ContainerName; SasToken must be non-empty. appsettings has real-looking values (committed SAS), so startup passes. Azurite URLs (`http://…/devstoreaccount1/<container>`) fail this validation. **Profile-image upload from a local stack writes to the real Azure container.** |
| `ProfileImages__MaximumFileSizeBytes`, `ProfileImages__AllowedContentTypes__0..n`    | **yes** (`ValidateOnStart`)             | appsettings: 2097152; jpeg/png/webp.                                                                                                                                                                                                                                                                                                            |
| `Smtp__Host/Port/Username/Password/From/EnableSsl`                                   | only outside Development                | See 4.6. Ignored in Development.                                                                                                                                                                                                                                                                                                                |
| `Firebase__ProjectId`                                                                | optional                                | If set, the `ReminderNotificationWorker` hosted service starts and pushes via FCM with Google ADC (`GOOGLE_APPLICATION_CREDENTIALS`). Empty → no push worker. Device registration endpoints still work.                                                                                                                                         |
| `DataProtection__KeysPath`                                                           | optional                                | Default `DataProtection-Keys`, relative to the working directory (`/app`), so keys are lost with the container. Used to encrypt stored push device tokens. Mount a volume if devices should survive a rebuild.                                                                                                                                  |
| `Consent__TermsVersion`                                                              | optional                                | Default `"1"`, stamped on the Terms consent at registration.                                                                                                                                                                                                                                                                                    |
| `ASPNETCORE_ENVIRONMENT`                                                             | recommended `Development` for local use | Enables Swagger and the `.dev-outbox` e-mail sink.                                                                                                                                                                                                                                                                                              |
| `ASPNETCORE_HTTP_PORTS`                                                              | image default 8080                      | No HTTPS in the container (8081 is exposed but no certificate is configured).                                                                                                                                                                                                                                                                   |

### 8.2 Migrations

`Program.cs` has no `Database.Migrate()` or `EnsureCreated()`, so the schema must be applied by hand:
`dotnet ef database update --project API.csproj` (migrations `20260929174945_InitialCreate` and `20260929175518_AddPushDevicesAndDeliveries`).
`Migrations/README.md` gives the wrong path (`--project src/FitnessApp.Api`). There is no `HasData`/`InsertData`, so the DB starts empty (no food catalogue).

### 8.3 Working stack used for this analysis (outside the repo)

`/Users/janick/Documents/GitHub/FitnessApp/mobilapp/docs/api-integration/docker/compose.yml`, project name `fitnessapp-dev`:

- `db`: `postgres:17-alpine` with db/user `fitnessapp`/`fitnessapp` and a healthcheck. Published on host **5433**.
- `migrate`: `mcr.microsoft.com/dotnet/sdk:10.0`. It copies the API source read-only (no `bin/obj` written into the repo), installs `dotnet-ef 10.*` and runs `dotnet ef database update`. It runs once; `api` waits for `service_completed_successfully`.
- `api`: built from `API/Dockerfile` with `ASPNETCORE_ENVIRONMENT=Development`, `ConnectionStrings__DefaultConnection=Host=db;…`, `DataProtection__KeysPath=/tmp/dp-keys`. Published **5210 → 8080**. Volume `./outbox:/app/.dev-outbox`, so verification and reset mails show up in `docs/api-integration/docker/outbox/*.txt`.
- Commands: `docker compose -f <that file> up -d --build` · `docker compose -f <that file> logs -f api` · `docker compose -f <that file> down -v` (wipes the DB).
- Smoke checks: `curl localhost:5210/health` → `Healthy`; `curl localhost:5210/api/v1/metadata`.

---

## 9. Gaps for the API team (cross-cutting)

See the structured result. In short, by severity:

- **blocker:** no CORS.
- **major:**
  - Tokens only after e-mail verification, no verification-status endpoint, and the same 401 for unverified and wrong password.
  - 64-hex tokens by plain e-mail with no link or short code.
  - No machine-readable error codes, and two different error shapes.
  - E-mail sending happens after the commit and fails as a 500 (stuck accounts).
  - No auto-migration, compose or seed data (and a wrong README path).
  - Committed secrets, and no local blob-storage option.
- **minor:**
  - Wrong current password on password change returns 401 (collides with the token-refresh interceptor).
  - Login by e-mail only.
  - Logout requires a valid access token.
  - No refresh grace period or reuse detection.
  - Access tokens survive revocation for up to 15 min.
  - Metadata lacks versions and ranges.
  - Health has no DB check.
  - A DateTime without an offset is treated as UTC.
  - The history cursor codec is inconsistent with the others.
  - The export includes soft-deleted food logs.
  - No rate limiting.
  - Delete-account has no re-authentication.
  - No dev hook for reading e-mails in automated tests.
