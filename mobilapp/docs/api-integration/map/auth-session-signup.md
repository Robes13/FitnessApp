# Auth, session, signup og kontolivscyklus – app ↔ API-mapping

Domæne: login, oprettelse (signup), e-mailbekræftelse, glemt adgangskode, token/session,
log ud, slet konto.
Kilder: `mobilapp/src/app/core/**`, `features/auth/**`, `features/signup/**`,
`features/home/components/verify-email-sheet/*`, `features/profile/components/profile-{logout,delete-account}-sheet/*`
og `API/Controllers/{Auth,Me,Consents,Profile,Goals,Settings,WeightLogs,Metadata}Controller.cs`,
`API/Services/Auth/*`, `API/Utilities/{ProfileValidation,SecretToken}.cs`, `API/Services/Goals/GoalCalculator.cs`, `API/Program.cs`.

Alt nedenfor er **verificeret live** mod dev-containeren `fitnessapp-dev-api-1`
(`http://localhost:5210`, `ASPNETCORE_ENVIRONMENT=Development`, mails havner i
`docs/api-integration/docker/outbox/*.txt`). Testkontoen er slettet (anonymiseret) igen via `DELETE /api/v1/me`.

---

## 0. Kort resumé

- **Passer direkte:** register, login, refresh, logout, resend-verification, forgot/reset password,
  `GET/DELETE /me`. Signup-kladden dækker alle felter, `RegisterRequest` kræver – og register
  opretter selv profil, mål, notifikationsindstilling og vilkårssamtykke i én transaktion. Der skal
  **ikke** kaldes Profile/Goals/Consents under signup.
- **Kræver mapping-logik i appen:** enums (dansk id → C#-navn), RPE 1–10 → `Low/Moderate/High`,
  7 træningsdage → antal, pace-id → kg/uge, `timeZoneId` fra `Intl`, adgangskodelængde 8 → 10,
  login med **e-mail** i stedet for brugernavn, token-paste i stedet for 4-cifret kode, fejlmapping
  fra engelske `ProblemDetails` til i18n-nøgler.
- **Mangler i API'et:** CORS; kort bekræftelseskode/deep link; bekræftelsesstatus for ubekræftede
  brugere; skift af e-mail før bekræftelse; separat "verify reset code"; maskinlæsbare fejlkoder;
  ugedage/RPE/kcal-override i profilen. Se §9.

---

## 1. API-fakta, der gælder alle kald

| Emne          | Faktisk opførsel (læst i koden + testet)                                                                                                                                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base-URL      | `http://localhost:5210/api/v1` (container: port 8080 → host 5210). Alle routes har præfiks `api/v1`.                                                                                                                                                                                                                                        |
| JSON-navne    | `AddControllers().AddJsonOptions(...)` uden egen naming policy → ASP.NET's web-defaults: **camelCase** ud og **case-insensitive** ind.                                                                                                                                                                                                      |
| Enums         | `JsonStringEnumConverter()` uden naming policy → serialiseres som **C#-navnet** (`"Male"`, `"LoseWeight"`, `"Moderate"`). Indlæsning er case-insensitive (`"male"`, `"loseWeight"` virker – testet). Tal (`1`) accepteres også. `StringValueAttribute` bruges **ikke** af serializeren. Ukendt værdi (`"mand"`) → 400 `errors["$.gender"]`. |
| Datoer        | `DateOnly` = `"YYYY-MM-DD"` (præcis; `"1998-05-16T00:00:00Z"` → 400). `DateTime` = ISO UTC med 7 decimaler, fx `"2026-09-30T06:27:43.6117436Z"`.                                                                                                                                                                                            |
| Decimaler     | JSON-tal, fx `178.00`, `75.50`.                                                                                                                                                                                                                                                                                                             |
| Fejlformat    | `GlobalExceptionHandler` → `ProblemDetails` `{ title, status, detail }` med **engelsk** `detail`. Modelvalidering (`[ApiController]`) → `ValidationProblemDetails` `{ type, title, status, errors: { "Password": [..] }, traceId }` – nøgler er **PascalCase C#-navne** eller JSON-stier (`"$.gender"`).                                    |
| Statuskoder   | `BusinessValidationException` → 400, `ConflictException` → 409, `UnauthorizedException` → 401, `UnauthorizedAccessException` → 403, `NotFoundException` → 404. JWT-afvisning → 401 **uden body** (`WWW-Authenticate: Bearer error="invalid_token"`).                                                                                        |
| Auth-model    | `Authorization: Bearer <accessToken>`. Access-token lever `Jwt:AccessTokenMinutes` = **15 min**, refresh-token `RefreshTokens:LifetimeDays` = **30 dage**, begge JWT (HS256). Refresh **roterer** (gammel token markeres `Used`; genbrug → 401 "The refresh token is no longer active.").                                                   |
| Aktiv konto   | `OnTokenValidated` afviser alle access-tokens for brugere, hvor `IsActive == false`, `EmailVerifiedAt == null` eller `DeletedAt != null`. → **En ubekræftet bruger kan ikke kalde noget `[Authorize]`-endpoint** og kan heller ikke logge ind.                                                                                              |
| CORS          | **Ikke konfigureret.** `OPTIONS /api/v1/auth/login` med `Origin: http://localhost:4200` → `405 Method Not Allowed`, ingen `Access-Control-*`-headers.                                                                                                                                                                                       |
| Mail (dev)    | `AccountMessageSender` skriver en `.txt` i `.dev-outbox` (mountet til `docs/api-integration/docker/outbox`). Indhold: `Your verification token is: <64 hex>` / `Your password reset token is: <64 hex>`. Intet link.                                                                                                                        |
| Tokens i mail | `SecretToken.Create()` = `Convert.ToHexString(32 random bytes)` → **64 tegn, store bogstaver `[0-9A-F]`**, sammenlignes via SHA-256-hash → **case-sensitive** (små bogstaver → 400, testet). Bekræftelse gælder 24 t, nulstilling 1 t.                                                                                                      |

---

## 2. Endpoints i domænet

| Verb + route                                  | Auth       | Request body                                                                          | Succes                                                                                                                                                             | Fejl                                                                                                                                                                |
| --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/auth/register`                  | anonym     | `RegisterRequest` (§3)                                                                | **201** `UserDto` (`isActive: false`, `emailVerifiedAt: null`). Ingen tokens. Sender bekræftelsesmail.                                                             | 400 validering/forretningsregel, 409 `"An account with that email already exists."` / `"That username is already in use."`                                          |
| `POST /api/v1/auth/login`                     | anonym     | `{ email: string (Required, EmailAddress, ≤320), password: string (Required, ≤200) }` | **200** `AuthResponse`                                                                                                                                             | 401 `"Invalid email or password."` (også ved ubekræftet/inaktiv/slettet konto), 400 hvis `email` ikke er en e-mail (fx et brugernavn)                               |
| `POST /api/v1/auth/refresh`                   | anonym     | `{ refreshToken: string }`                                                            | **200** `AuthResponse` (ny access + ny refresh)                                                                                                                    | 401 ugyldig/udløbet/brugt                                                                                                                                           |
| `POST /api/v1/auth/logout`                    | **Bearer** | `{ refreshToken: string }`                                                            | **204** (refresh-token → `Revoked`)                                                                                                                                | 401 uden gyldigt access-token, 403 hvis refresh-token tilhører en anden bruger                                                                                      |
| `POST /api/v1/auth/logout-all`                | Bearer     | –                                                                                     | 204                                                                                                                                                                | 401                                                                                                                                                                 |
| `POST /api/v1/auth/email/verify`              | anonym     | `{ token: string }`                                                                   | **204** (`EmailVerifiedAt` sættes, `IsActive = true`)                                                                                                              | 400 `"The verification token is invalid or expired."`                                                                                                               |
| `POST /api/v1/auth/email/resend-verification` | anonym     | `{ email: string (EmailAddress) }`                                                    | **204 altid** (no-op hvis ukendt/bekræftet). **Ugyldiggør alle tidligere bekræftelsestokens.**                                                                     | 400 kun ved ugyldigt e-mailformat                                                                                                                                   |
| `POST /api/v1/auth/password/forgot`           | anonym     | `{ email: string (EmailAddress) }`                                                    | **204 altid** (no-op hvis ukendt, **ubekræftet** eller slettet). Revokerer tidligere reset-tokens.                                                                 | 400 ugyldigt format                                                                                                                                                 |
| `POST /api/v1/auth/password/reset`            | anonym     | `{ token, newPassword (≥10), newPasswordConfirmation }`                               | **204**. Revokerer alle refresh-tokens.                                                                                                                            | 400 `"The password reset token is invalid or expired."`, 400 `errors.NewPassword` (min 10), 400 `"Password must be at least 10 characters and match confirmation."` |
| `POST /api/v1/auth/password/change`           | Bearer     | `{ currentPassword, newPassword (≥10), newPasswordConfirmation }`                     | 204                                                                                                                                                                | 401 `"Current password is invalid."` (ikke brugt af appen i dag)                                                                                                    |
| `GET /api/v1/me`                              | Bearer     | –                                                                                     | 200 `UserDto`                                                                                                                                                      | 401, 404                                                                                                                                                            |
| `PATCH /api/v1/me`                            | Bearer     | `{ email?: string, username?: string (3–50) }`                                        | 200 `UserDto`. **Ny e-mail ⇒ `EmailVerifiedAt = null`, `IsActive = false`, alle refresh-tokens revokeres, ny bekræftelsesmail** → brugeren er i praksis logget ud. | 409 e-mail/brugernavn optaget, 400                                                                                                                                  |
| `DELETE /api/v1/me`                           | Bearer     | –                                                                                     | **204**. Sletter logs, mål, profil, samtykker, tokens m.m. og anonymiserer `User`-rækken. Samme access-token giver derefter 401.                                   | 401, 404                                                                                                                                                            |
| `GET /api/v1/me/profile`                      | Bearer     | –                                                                                     | 200 `UserProfileDto`                                                                                                                                               | 404 (tom body)                                                                                                                                                      |
| `GET /api/v1/me/goals/current`                | Bearer     | –                                                                                     | 200 `UserGoalDto`                                                                                                                                                  | 404                                                                                                                                                                 |
| `GET /api/v1/me/weight-logs/latest`           | Bearer     | –                                                                                     | 200 `LatestWeightDto` (falder tilbage til `startingWeight` med `isStartingWeight: true`)                                                                           | 404                                                                                                                                                                 |
| `GET /api/v1/me/settings`                     | Bearer     | –                                                                                     | 200 `UserSettingDto[]`                                                                                                                                             | 401                                                                                                                                                                 |
| `GET /api/v1/me/consents`                     | Bearer     | `?limit&cursor`                                                                       | 200 `CursorPage<UserConsentDto>`                                                                                                                                   | –                                                                                                                                                                   |
| `GET /api/v1/metadata`                        | anonym     | –                                                                                     | 200 lister over enum-navne (`genders`, `trainingIntensities`, `goalTypes`, `settingKeys`, `consentTypes` …)                                                        | –                                                                                                                                                                   |

### Response-typer (præcise JSON-navne)

```ts
// UserDto
{
  userId: number;
  email: string;
  username: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

// AuthResponse
{
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: UserDto;
}

// UserProfileDto
{
  userProfileId: number;
  userId: number;
  birthDate: string; /* YYYY-MM-DD */
  gender: 'Unspecified' | 'Male' | 'Female' | 'Other' | 'PreferNotToSay';
  height: number;
  startingWeight: number;
  dailySteps: number;
  trainingDaysPerWeek: number;
  workoutDurationMinutes: number;
  trainingIntensity: 'Low' | 'Moderate' | 'High';
  timeZoneId: string;
  profileImageUrl: string | null;
}

// UserGoalDto
{
  userGoalId: number;
  goalType: 'LoseWeight' | 'MaintainWeight' | 'GainWeight';
  targetWeight: number;
  weightChangePerWeek: number;
  targetDailyCalories: number;
  targetProtein: number;
  targetCarbohydrates: number;
  targetFat: number;
  createdAt: string;
}

// LatestWeightDto
{
  weightLogId: number | null;
  weight: number;
  recordedAt: string;
  isStartingWeight: boolean;
}

// UserSettingDto
{
  settingKey: 'Theme' |
    'Notifications' |
    'MealReminders' |
    'WeightReminders' |
    'Language' |
    'WeightUnit' |
    'AllowStepsSharing';
  settingValue: string;
  updatedAt: string;
}
```

Live-eksempel lige efter register + verify + login: `settings = [{ settingKey: "Notifications", settingValue: "true" }]`,
`consents.items = [{ consentType: "Terms", documentVersion: "1", withdrawnAt: null }]`,
`goals/current.targetDailyCalories = 1907.68`.

---

## 3. Feltmapping: signup-kladde → `POST /auth/register`

Signup-kladden er `SignupStateService` (signals) → `toProfile(): UserProfile`. `RegisterRequest`
(`API/DTOs/Auth/RegisterRequest.cs`) er fladt – ingen `profile`-underobjekt, som appens nuværende
`core/models/auth.ts` `RegisterRequest { password, profile }` antager.

| App (signal / `UserProfile`)                  | Trin                  | App-type / værdier                                           | API-felt                 | API-type / regel                                                                                                                           | Mapping                                                                                                                                                                                                                   |
| --------------------------------------------- | --------------------- | ------------------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `username`                                    | account               | string, `trim().length > 0`                                  | `username`               | string, **Required, 3–50** tegn (trimmes), unik (case-**sensitiv**)                                                                        | `username.trim()`. App-validering skal hæves til 3–50.                                                                                                                                                                    |
| `password`                                    | account               | ≥ 8 (`PASSWORD_MIN_LENGTH`)                                  | `password`               | **Required, 10–200**                                                                                                                       | Send som den er. `PASSWORD_MIN_LENGTH` → 10 i appen.                                                                                                                                                                      |
| `passwordRepeat`                              | account               | skal = password                                              | `passwordConfirmation`   | Required, skal = password                                                                                                                  | Send `passwordRepeat()`.                                                                                                                                                                                                  |
| `email`                                       | summary               | `isValidEmail`                                               | `email`                  | **Required, EmailAddress, ≤ 320**; gemmes `trim().toLowerCase()`                                                                           | `email.trim()`                                                                                                                                                                                                            |
| `birthday`                                    | birthday              | `'YYYY-MM-DD' \| null`, alder 16–120                         | `birthDate`              | `DateOnly` (ikke-null i praksis), alder **13–100**                                                                                         | Send strengen uændret. Aldrig `null` ved submit (canContinue sikrer det). App-`MAX_AGE` bør være 100.                                                                                                                     |
| `gender`                                      | gender                | `'mand' \| 'kvinde' \| 'andet'`                              | `gender`                 | `Gender` enum                                                                                                                              | `mand→"Male"`, `kvinde→"Female"`, `andet→"Other"`                                                                                                                                                                         |
| `weightKg`                                    | weight                | 30–300, hele kg                                              | `startingWeight`         | decimal **25–400**                                                                                                                         | 1:1                                                                                                                                                                                                                       |
| `heightCm`                                    | height                | **55–250** (`HEIGHT_MIN_CM = 55`)                            | `height`                 | decimal **100–250**                                                                                                                        | 1:1, men værdier 55–99 afvises (400 `"Height must be between 100 and 250 cm."`). Appen skal enten sætte `HEIGHT_MIN_CM = 100` eller blokere "Videre" under 100.                                                           |
| `stepsPerDay`                                 | activity              | 0–50 000                                                     | `dailySteps`             | int 0–100 000                                                                                                                              | 1:1                                                                                                                                                                                                                       |
| `trainingDays`                                | training-frequency    | `readonly boolean[7]`, mandag først                          | `trainingDaysPerWeek`    | int 0–7                                                                                                                                    | `trainingDays.filter(Boolean).length` – **hvilke** ugedage går tabt.                                                                                                                                                      |
| `trainingMinutes`                             | training-duration     | 10–180 (default 45, også ved 0 dage)                         | `workoutDurationMinutes` | int 0–480                                                                                                                                  | 1:1 (45 ved 0 dage er harmløst – API ganger med 0 dage).                                                                                                                                                                  |
| `trainingRpe`                                 | training-intensity    | `1..10 \| null` (null når trinnet er sprunget over)          | `trainingIntensity`      | `TrainingIntensity` enum, **skal være defineret** – mangler feltet → 0 → 400 `"A profile enum value is invalid."` (testet)                 | `calculator.intensityFor(rpe)?.id ?? TRAINING_FALLBACK_INTENSITY` → `mildt→"Low"`, `moderat→"Moderate"`, `haardt→"High"`. (RPE ≤4 / ≤7 / ≤10 jf. `INTENSITIES.maxRpe`.)                                                   |
| `goal`                                        | goal                  | `'tabe' \| 'hold' \| 'tage'`                                 | `goalType`               | `GoalType` enum (ingen default – 0 er udefineret)                                                                                          | `tabe→"LoseWeight"`, `hold→"MaintainWeight"`, `tage→"GainWeight"`                                                                                                                                                         |
| `goalWeightKg` (klemt: `boundedGoalWeightKg`) | goal-weight           | 35–200, `< vægt` ved tabe, `> vægt` ved tage                 | `targetWeight`           | `decimal?` 25–400; ved Lose skal `< startingWeight`, ved Gain `> startingWeight`; **ignoreres** ved Maintain (API bruger `startingWeight`) | Send `null` ved `hold`, ellers værdien. Kant: `goalWeightBounds('tabe', w)` giver `max = max(36, w−1)` → ved vægt ≤ 36 kg kan målet blive ≥ vægten → 400 `"Target weight and change pace must match the selected goal."`. |
| `pace`                                        | pace                  | `'rolig' \| 'moderat' \| 'hurtig' \| null` (null ved `hold`) | `weightChangePerWeek`    | `decimal?` 0 < x ≤ 1 ved Lose/Gain; 0/null ved Maintain                                                                                    | `PACES.find(p => p.id === pace)?.kgPerWeek` → `0.25 / 0.5 / 1`; `null` ved `hold`.                                                                                                                                        |
| `notifications`                               | notifications         | `boolean \| null`                                            | `notificationsEnabled`   | bool → gemmes som `UserSetting Notifications = "true"/"false"`                                                                             | `notifications() === true`                                                                                                                                                                                                |
| `termsAccepted`                               | summary               | boolean                                                      | `acceptedTerms`          | bool, **skal være true** (ellers 400 `"Terms must be accepted to create an account."`). Opretter selv `UserConsent { Terms, "1" }`.        | 1:1. **Intet** kald til `/me/consents` ved signup.                                                                                                                                                                        |
| – (indsamles ikke)                            | –                     | –                                                            | `timeZoneId`             | **Required, ≤100**, skal findes via `TimeZoneInfo.FindSystemTimeZoneById` (IANA virker, `"Mars/Olympus"` → 400)                            | `Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'`                                                                                                                                                               |
| `units`                                       | – (altid `'metrisk'`) | `'metrisk' \| 'imperial'`                                    | –                        | ikke i register; senere `PUT /me/settings/WeightUnit { value: "kg" \| "lb" }`                                                              | Spring over ved signup (default metrisk = kg).                                                                                                                                                                            |
| `kcalOverride`                                | – (altid `null`)      | `number \| null`                                             | –                        | findes ikke                                                                                                                                | Kun lokalt (gap).                                                                                                                                                                                                         |
| `photo`                                       | – (altid `null`)      | –                                                            | –                        | `PUT /me/profile/image` (multipart) – andet domæne                                                                                         | Ikke en del af signup.                                                                                                                                                                                                    |

### Eksempel på korrekt body (testet → 201)

```json
{
  "email": "dig@mail.dk",
  "username": "mads",
  "password": "<≥10 tegn>",
  "passwordConfirmation": "<samme>",
  "birthDate": "1998-05-16",
  "gender": "Male",
  "startingWeight": 75.5,
  "height": 178,
  "dailySteps": 6000,
  "trainingDaysPerWeek": 3,
  "workoutDurationMinutes": 45,
  "trainingIntensity": "Moderate",
  "goalType": "LoseWeight",
  "targetWeight": 70,
  "weightChangePerWeek": 0.5,
  "notificationsEnabled": true,
  "acceptedTerms": true,
  "timeZoneId": "Europe/Copenhagen"
}
```

### Valideringsforskelle, appen skal rette sig efter

| Regel             | App i dag                              | API                          | Handling i appen                                                                                                                                                                              |
| ----------------- | -------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adgangskode min.  | 8 (`PASSWORD_MIN_LENGTH`)              | 10 (register, reset, change) | → 10. Tekster "Mindst 8 tegn." (`signup.accountStep.minLengthHint`, `core.auth.error.passwordTooShort`, `auth.forgotPasswordPage.passwordBody`) → 10. `passwordStrength()` bruger konstanten. |
| Adgangskode maks. | –                                      | 200                          | Tilføj `PASSWORD_MAX_LENGTH = 200`.                                                                                                                                                           |
| Brugernavn        | `> 0` tegn                             | 3–50                         | `USERNAME_MIN_LENGTH = 3`, `USERNAME_MAX_LENGTH = 50` + hint.                                                                                                                                 |
| Højde             | 55–250                                 | 100–250                      | `HEIGHT_MIN_CM` → 100 (eller gap, se §9).                                                                                                                                                     |
| Alder             | 16–120                                 | 13–100                       | `MAX_AGE` → 100.                                                                                                                                                                              |
| Nulstillingskode  | 4 cifre (`RESET_CODE_LENGTH`), kun tal | 64 hex, store bogstaver      | Se §5.4.                                                                                                                                                                                      |

### Hvad API'et regner ud selv

Register kører `GoalCalculator.Calculate(...)` og gemmer `targetDailyCalories/Protein/Carbohydrates/Fat`
(makro 30/40/30). Appen regner selv (PAL-tabel, 30/45/25, adaptivt mål) – tallene vil **ikke** stemme
overens. Det hører til nutrition/goals-domænet, men bør afklares der.

---

## 4. Omvendt mapping ved login (API → `UserProfile`)

Efter `POST /auth/login` skal den lokale profil hydreres (ny enhed/geninstallation):

| `UserProfile`-felt      | Kilde                                 | Mapping                                                                                            |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `username`, `email`     | `AuthResponse.user`                   | 1:1                                                                                                |
| `birthday`              | `GET /me/profile` `birthDate`         | 1:1                                                                                                |
| `gender`                | `gender`                              | `Male→mand`, `Female→kvinde`, `Other/Unspecified/PreferNotToSay→andet` (samme BMR-offset −78)      |
| `heightCm`              | `height`                              | 1:1                                                                                                |
| `stepsPerDay`           | `dailySteps`                          | 1:1                                                                                                |
| `trainingDays`          | `trainingDaysPerWeek`                 | Behold det lokale mønster, hvis antallet matcher; ellers de første N dage (mandag først) = `true`. |
| `trainingMinutes`       | `workoutDurationMinutes`              | 1:1                                                                                                |
| `trainingRpe`           | `trainingIntensity`                   | `Low→3`, `Moderate→6`, `High→9` (= `INTENSITIES[].rpe`); `null` hvis `trainingDaysPerWeek === 0`   |
| `weightKg`              | `GET /me/weight-logs/latest` `weight` | 1:1 (falder tilbage til `startingWeight`)                                                          |
| `goal`                  | `GET /me/goals/current` `goalType`    | omvendt af §3                                                                                      |
| `goalWeightKg`          | `targetWeight`                        | 1:1                                                                                                |
| `pace`                  | `weightChangePerWeek`                 | `0 → null`, ellers `PACES` med nærmeste `kgPerWeek`                                                |
| `notificationsEnabled`  | `GET /me/settings` `Notifications`    | `settingValue === "true"` (mangler → `true`)                                                       |
| `units`                 | `WeightUnit`                          | `"lb" → imperial`, ellers `metrisk`                                                                |
| `kcalOverride`, `photo` | –                                     | Bevar lokal værdi (gap / andet domæne)                                                             |

404 på profil/mål/vægt → behold `DEFAULT_PROFILE`-værdier for de felter.

---

## 5. Request-sekvenser

### 5.1 Signup (ny)

```
SignupPage."Opret konto"
 └─ SignupStateService.submit()
     └─ SessionService.register(profile, password, passwordRepeat)
         1. POST /auth/register  (toRegisterRequest(...))         → 201 UserDto
            409 → EMAIL_TAKEN / USERNAME_TAKEN (skelnes på detail-tekst)
            400 → felt-/regelfejl (fx HEIGHT, PASSWORD)
         2. UserProfileService.replace(profile)                    (som i dag – først efter 201)
         3. session = { status: 'pending-verification', email }    (gemmes)
            password + email holdes KUN i hukommelsen (private felt i SessionService)
         ✗ INTET resend-kald her – register har allerede sendt mailen, og resend
           ugyldiggør den første token (testet).
 └─ navigate /hjem  → VerifyEmailSheet (låser Hjem)
```

### 5.2 E-mailbekræftelse (verify-email-sheet)

```
Bruger indsætter token fra mailen  → SessionService.verifyEmail(token)
  1. POST /auth/email/verify { token: input.trim().toUpperCase() }   → 204
     400 → INVALID_CODE ("Koden er ugyldig eller udløbet")
  2. har vi password i hukommelsen?
       ja  → POST /auth/login { email, password } → AuthResponse → tokens gemmes
             → hydrate (§5.3 trin 3) → status 'authenticated' → arket lukker
       nej (appen er genstartet) → status 'guest' → /login (e-mail forudfyldt)

"Tjek igen" → SessionService.checkVerification()
  - password i hukommelsen: POST /auth/login → 200 = bekræftet (som ovenfor)
                                             → 401 = ikke bekræftet endnu (vi har selv lige
                                               oprettet kontoen med de oplysninger)
  - ellers: `false` + hint om at indsætte koden / logge ind
  (Workaround – der findes intet status-endpoint, se gap G3.)

"Gensend kode" → POST /auth/email/resend-verification { email } → 204 (altid)
  Fjern `session.markEmailVerified()`-TODO'en i `resend()`.

"Ændre mail" → ikke muligt for en ubekræftet konto (PATCH /me kræver bekræftet JWT).
  Skjul knappen i 'pending-verification' indtil API'et understøtter det (gap G5).
```

### 5.3 Login

```
LoginPage.submit()  (feltet bliver "E-mail")
 └─ SessionService.login(email, password)
     1. POST /auth/login { email, password }              → 200 AuthResponse
        401 → INVALID_CREDENTIALS ("Forkert e-mail eller adgangskode – eller er mailen ikke bekræftet?")
        400 → INVALID_EMAIL
        status 0 → NETWORK
     2. gem { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, userId }
        Er userId ≠ sidst gemte userId → ryd brugerspecifikke lokale nøgler først.
     3. hydrate (parallelt, forkJoin, 404 → null):
          GET /me/profile · GET /me/goals/current · GET /me/weight-logs/latest · GET /me/settings
        → UserProfileService.replace(merge(local, fromApi(...)))   (§4)
     4. status 'authenticated'  → navigate /hjem
```

### 5.4 Glemt adgangskode (samme fire trin i UI'et)

```
email   → POST /auth/password/forgot { email }        → 204 (altid – også ukendt/ubekræftet)
          "Send igen" = samme kald (revokerer den forrige token)
code    → INTET API-kald (der findes ikke et verify-endpoint).
          verifyResetCode() bliver lokal: trim + toUpperCase, tjek /^[0-9A-F]{64}$/,
          gem token i sidens state, gå til 'new-password'.
          Kodefeltet: fjern cifferfilteret og 4-tegnsgrænsen (tokenet indsættes).
new-pw  → POST /auth/password/reset { token, newPassword, newPasswordConfirmation } → 204
          400 "…token is invalid or expired." → tilbage til 'code' med INVALID_CODE
          400 errors.NewPassword               → PASSWORD_TOO_SHORT
done    → POST /auth/login { email: <e-mail fra trin 1>, password: <ny> } → §5.3 trin 2–4
          (i dag bruges profile().username – skal være e-mailen)
```

Tekster: "Vi sender en 4-cifret kode." / "Koden er 4 cifre." / "gælder i 15 minutter" passer ikke
(token på 64 tegn, gyldig i 1 time).

### 5.5 Token-fornyelse (interceptor)

```
Hver request til API_BASE_URL (IKKE Open Food Facts):
  - accessTokenExpiresAt < nu + 30 s → refresh først
  - sæt Authorization: Bearer <accessToken>
  - 401 på et ikke-auth-endpoint → refresh én gang → gentag én gang
Refresh: POST /auth/refresh { refreshToken } → ny AuthResponse (begge tokens skiftes)
  - skal være single-flight (shareReplay): to samtidige refresh med samme token → den ene får 401
  - 401 på refresh → lokal log ud → /login
```

### 5.6 Log ud

```
ProfileLogoutSheet.confirmed → SessionService.logout()
  1. sikr frisk access-token (§5.5) – byg body EFTER evt. refresh, ellers revokeres
     den gamle (allerede brugte) token, mens den nye forbliver aktiv
  2. POST /auth/logout { refreshToken } med Bearer   → 204
  3. finalize: ryd tokens + status 'guest' uanset resultat (best effort)
  Lokale data bevares som i dag ("Dine data gemmes"). Access-tokenet virker indtil udløb (15 min) – testet.
```

### 5.7 Slet konto

```
ProfileDeleteAccountSheet.confirmed → SessionService.deleteAccount(): Observable<void>
  1. DELETE /api/v1/me  (Bearer)          → 204
     fejl → vis fejl i arket, slet INTET lokalt
  2. som i dag: state → guest, profile.resetToDefaults(), storage.clearAll(), reload til /login
```

---

## 6. Fejlmapping (HttpErrorResponse → `ApiError.messageKey`)

API'et har ingen fejlkoder, så mappingen sker på (endpoint, status, evt. `detail`):

| Kilde               | Betingelse                             | Ny nøgle (da/en)                                                                                   |
| ------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| alle                | `status === 0`                         | `core.auth.error.network`                                                                          |
| alle                | `status >= 500`                        | `core.auth.error.server`                                                                           |
| login               | 401                                    | `core.auth.error.invalidCredentials`                                                               |
| login/forgot/resend | 400 med `errors.Email`                 | `core.auth.error.invalidEmail` (findes)                                                            |
| register            | 409 + `detail` indeholder `"email"`    | `core.auth.error.emailTaken`                                                                       |
| register            | 409 + `detail` indeholder `"username"` | `core.auth.error.usernameTaken`                                                                    |
| register            | 400 `errors.Password`                  | `core.auth.error.passwordTooShort` (findes, tekst → 10)                                            |
| register            | 400 øvrige                             | `signup.page.submitError` (findes)                                                                 |
| verify / reset      | 400 `"…token is invalid or expired."`  | `core.auth.error.invalidCode` (findes, ny tekst)                                                   |
| delete / logout     | ≠ 2xx                                  | `common.error.requestFailed` (eller `home.verifyEmail.requestFailed`-teksten flyttet til `common`) |

`core.auth.error.noBackend` fjernes.

---

## 7. Implementeringsplan (efter `ARCHITECTURE.md`)

Princip: al HTTP i `core/services`, mapping som rene funktioner med egen spec, komponenter
kender kun `SessionService`. Ingen nye afhængigheder. `features → shared → core`.

### Nye filer

| Fil                                                              | Indhold                                                                                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/environments/environment.ts` / `environment.development.ts` | `apiBaseUrl`: dev = `'/api/v1'` (via proxy), prod/native = `'<API-host>/api/v1'` (skal oplyses). `angular.json` `fileReplacements` i `development`.                             |
| `proxy.conf.json` (+ `angular.json` `serve.options.proxyConfig`) | `"/api": { "target": "http://localhost:5210" }` – omgår manglende CORS under `npm start`.                                                                                       |
| `core/constants/api.ts`                                          | `API_BASE_URL` (`InjectionToken<string>`, factory fra environment) + `apiUrl(endpoint)`.                                                                                        |
| `core/models/account.ts`                                         | `UserProfileDto`, `UserGoalDto`, `LatestWeightDto`, `UserSettingDto`, `ApiGender`, `ApiTrainingIntensity`, `ApiGoalType`, `ApiSettingKey` (string-unions).                      |
| `core/services/auth-api/auth-mapping.ts` (+ `.spec.ts`)          | `toRegisterRequest(profile, password, confirmation, timeZoneId)`, `GENDER_TO_API`, `GOAL_TO_API`, `intensityToApi(rpe)`, `paceToKgPerWeek(pace)`, `toApiError(error, context)`. |
| `core/services/account-api/account-api.ts` (+ spec)              | `getProfile()`, `getCurrentGoal()`, `getLatestWeight()`, `getSettings()` (404 → `null`), `deleteAccount()`. Koordinér med profil-/mål-domænet, som ejer PATCH/PUT.              |
| `core/services/account-api/account-mapping.ts` (+ spec)          | `profileFromApi(local, user, profileDto, goalDto, weightDto, settings): UserProfile` (§4).                                                                                      |
| `core/interceptors/auth.interceptor.ts` (+ spec, `README.md`)    | Funktionel `HttpInterceptorFn` (§5.5). Kun for URL'er, der starter med `API_BASE_URL`.                                                                                          |

### Ændrede filer

| Fil                                                          | Ændring                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.config.ts`                                              | `provideHttpClient(withFetch(), withInterceptors([authInterceptor]))`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `capacitor.config.ts`                                        | `plugins.CapacitorHttp.enabled = true` (native HTTP → ingen CORS i WebView'et). Kun til lokal http-API på Android: `server.cleartext`/`android.allowMixedContent` i en dev-konfiguration.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `core/constants/auth.ts`                                     | `AUTH_ENDPOINT` rettes til de rigtige stier: `REGISTER 'auth/register'`, `LOGIN 'auth/login'`, `REFRESH 'auth/refresh'`, `LOGOUT 'auth/logout'`, `VERIFY_EMAIL 'auth/email/verify'`, `RESEND_VERIFICATION 'auth/email/resend-verification'` (i dag fejlagtigt `auth/verification/resend`), `FORGOT_PASSWORD 'auth/password/forgot'`, `RESET_PASSWORD 'auth/password/reset'`; fjern `VERIFICATION_STATUS`. Tilføj `ME_ENDPOINT`, `USERNAME_MIN/MAX_LENGTH`, `PASSWORD_MAX_LENGTH`, `AUTH_TOKEN_PATTERN = /^[0-9A-F]{64}$/`, `TOKEN_REFRESH_MARGIN_MS`, nye fejlnøgler; fjern `NO_BACKEND`. |
| `core/constants/nutrition.ts`                                | `PASSWORD_MIN_LENGTH 10`, `HEIGHT_MIN_CM 100`, `MAX_AGE 100`; `RESET_CODE_LENGTH` erstattes af `AUTH_TOKEN_PATTERN`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `core/models/auth.ts`                                        | API-formede typer: `RegisterRequest` (fladt, §3), `LoginRequest`, `AuthResponse`, `ApiUser` (= `UserDto`), `RefreshRequest`, `VerifyEmailRequest`, `EmailRequest`, `ResetPasswordRequest`, `ProblemDetails`/`ValidationProblemDetails`. Fjern `VerificationStatusResponse`.                                                                                                                                                                                                                                                                                                               |
| `core/models/session.ts`                                     | `SessionState { status: 'guest' \| 'pending-verification' \| 'authenticated'; email: string \| null; userId: number \| null; tokens: AuthTokens \| null }`. `restore()` oversætter det gamle `{ isLoggedIn, isEmailVerified }`.                                                                                                                                                                                                                                                                                                                                                           |
| `core/services/auth-api/auth-api.ts`                         | `HttpClient`-kald for alle metoder i §2; `stub()`/`notImplemented()`/`AUTH_API_DELAY_MS` fjernes (også fra `core/testing/test-providers.ts`). Fejl → `toApiError`.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `core/services/session/session.ts`                           | `isLoggedIn = status !== 'guest'`, `isEmailVerified = status === 'authenticated'` (guards/Home uændrede). Nye/ændrede metoder: `register`, `verifyEmail`, `checkVerification`, `resendVerification`, `login(email, …)`, `logout(): Observable<void>`, `deleteAccount(): Observable<void>`, `accessToken()`, `refresh()` (single-flight). `completeSignup()` og `markEmailVerified()` fjernes.                                                                                                                                                                                             |
| `features/signup/services/signup-state.ts`                   | `submit()` → `session.register(this.toProfile(), password, passwordRepeat)`; `AuthApi`-injektion fjernes. `canContinue('account')`: brugernavn 3–50, adgangskode 10–200.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `features/signup/pages/signup-page/signup-page.ts`           | Viser de nye fejlnøgler (e-mail/brugernavn optaget).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `features/signup/components/steps/account-step/*`            | Hint for brugernavnslængde; min-længde-hint 10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `features/signup/components/steps/height-step/*`             | Skala/knapper fra 100 cm (via `HEIGHT_MIN_CM`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `features/auth/pages/login-page/*`                           | `username` → `email` (`type="email"`, `inputMode="email"`, `autocomplete="email"`, nøgle `auth.loginPage.email`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `features/auth/pages/forgot-password-page/*`                 | Token i stedet for 4 cifre; `verifyCode()` lokal; `savePassword()` → `resetPassword(token, pw, repeat)`; ugyldig token → trin `code`; slutlogin med e-mailen.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `features/home/components/verify-email-sheet/*`              | Nyt tokenfelt + "Bekræft"; "Tjek igen" = login-forsøg; fjern TODO'en; skjul "Ændre mail" mens status er `pending-verification`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `features/profile/pages/profile-page/profile-page.ts`        | `logout()`/`deleteAccount()` abonnerer; `deleting`/`deleteErrorKey`-signals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `features/profile/components/profile-delete-account-sheet/*` | Nye inputs `busy: boolean` og `errorMessage: string \| null` (loading på "Ja, slet min konto", fejl i `UiFormError`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/i18n/da.json`, `en.json`                                | Nye nøgler (§6), login-feltet "E-mail", tokenfelt i verify-arket og glemt-adgangskode, 10-tegns-tekster, "gælder i 1 time".                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| README'er                                                    | `core/services/README.md`, `core/constants/README.md`, `core/interceptors/README.md` (ny), `core/testing/README.md`, `features/auth/README.md` + sidernes, `features/signup/README.md` ("Oprettelsen"), `verify-email-sheet/README.md`, `profile-delete-account-sheet/README.md`.                                                                                                                                                                                                                                                                                                         |

### Tests

- **Unit (vitest + `provideHttpClient()` + `provideHttpClientTesting()`):**
  `auth-mapping.spec` (alle rækker i §3 inkl. `hold` → `targetWeight: null`, 0 træningsdage →
  `trainingIntensity` sat, pace → kg/uge, fejlmapping), `account-mapping.spec` (§4),
  `auth-api.spec` (URL, verb, body, fejl), `auth.interceptor.spec` (Bearer kun til API-URL, ingen
  til Open Food Facts, single-flight refresh, retry én gang, log ud ved refresh-401),
  `session.spec` (register → pending uden resend, verify → login, check = 401 → false,
  logout best effort, delete sletter først lokalt efter 204), opdaterede side-/komponent-specs.
- **UI mod live docker:** `npm start` (proxy) → opret konto i UI'et → hent token fra
  `docs/api-integration/docker/outbox/*.txt` → indsæt i verify-arket → Hjem låst op → log ud → log ind med
  e-mail → glemt adgangskode med token fra outbox → slet konto.

---

## 8. Hvad der blev testet live (dev-docker)

| Test                                                                                                | Resultat                                             |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| CORS-preflight                                                                                      | 405, ingen CORS-headers                              |
| Register med 8-tegns adgangskode                                                                    | 400 `errors.Password` (min 10)                       |
| Register uden `trainingIntensity`                                                                   | 400 `"A profile enum value is invalid."`             |
| Register med `height: 90`                                                                           | 400 `"Height must be between 100 and 250 cm."`       |
| Register med små-bogstavs-enums (`"male"`, `"loseWeight"`)                                          | 201 – case-insensitive                               |
| Register med `"gender": "mand"` / `birthDate` med tid                                               | 400 `errors["$.gender"]` / `errors["$.birthDate"]`   |
| Dublet                                                                                              | 409 `"An account with that email already exists."`   |
| Login før bekræftelse                                                                               | 401 `"Invalid email or password."`                   |
| Login med brugernavn i `email`                                                                      | 400 `errors.Email`                                   |
| Resend → gammel token                                                                               | 400 (ugyldiggjort)                                   |
| Verify med små bogstaver                                                                            | 400 (case-sensitive)                                 |
| Verify korrekt → login                                                                              | 204 → 200 `AuthResponse`                             |
| `/me`, `/me/profile`, `/me/goals/current`, `/me/settings`, `/me/consents`, `/me/weight-logs/latest` | Som i §2                                             |
| Refresh → genbrug gammel refresh                                                                    | 200 → 401 `"The refresh token is no longer active."` |
| Logout uden Bearer / med Bearer                                                                     | 401 / 204; access-token virker stadig bagefter (200) |
| Forgot (ukendt / kendt)                                                                             | 204 / 204 + mail med 64-hex token                    |
| Reset med `"1234"` / 8 tegn / korrekt / genbrug                                                     | 400 / 400 / 204 / 400                                |
| DELETE /me → samme token → login                                                                    | 204 → 401 → 401                                      |

---

## 9. Gaps til API-teamet (kan sendes videre som de står)

- **[major] G1 – CORS mangler.** `Program.cs` har hverken `AddCors` eller `UseCors`; en preflight giver
  `405`. Browseren (`ng serve`, `http://localhost:4200`) og Capacitor-WebView'et (`capacitor://localhost`
  på iOS, `https://localhost` på Android) kan ikke kalde API'et direkte. Ønske: CORS-politik for de
  tre origins med `Authorization` + `Content-Type`-headers og metoderne `GET, POST, PUT, PATCH, DELETE`.
  (Appen omgår det midlertidigt med dev-proxy og `CapacitorHttp`.)
- **[major] G2 – E-mailbekræftelse er et 64-tegns hex-token i en ren tekstmail.** Ingen link, ingen
  kort kode, og tokenet er case-sensitivt. På en telefon skal brugeren kopiere 64 tegn. Ønske: en
  6-cifret kode (med forsøgsgrænse) og/eller et deep/universal link
  (fx `https://…/verify?token=…` → appen), og case-insensitiv sammenligning.
- **[major] G3 – Ingen måde at se bekræftelsesstatus som ubekræftet bruger.** Register returnerer ingen
  tokens, login giver 401 for ubekræftede, og `OnTokenValidated` afviser alle tokens uden
  `EmailVerifiedAt`. Appens "Tjek igen" kan derfor ikke spørge `GET /me`. Ønske: enten
  (a) `POST /auth/email/verify` returnerer `AuthResponse` (auto-login), og/eller
  (b) `GET /auth/email/status?email=` → `{ verified: boolean }`, eller
  (c) register returnerer et begrænset "pending"-token, som må kalde `GET /me`.
- **[major] G4 – Login skelner ikke mellem forkert adgangskode og ubekræftet e-mail.** Begge giver 401
  `"Invalid email or password."`. Ønske: når adgangskoden er korrekt, men e-mailen ubekræftet → 403
  med kode `email_not_verified`, så appen kan vise verify-arket i stedet for en forkert fejl.
- **[major] G5 – E-mail kan ikke rettes før bekræftelse.** Verify-arket har "Ændre mail", men
  `PATCH /me` kræver bekræftet JWT, og en ny registrering fejler med 409, fordi den ventende konto
  holder brugernavn og e-mail. Ubekræftede konti udløber heller aldrig. Ønske:
  `POST /auth/email/change-pending { currentEmail, password, newEmail }` (anonym) – eller at register
  må overskrive en ubekræftet konto – og oprydning af ubekræftede konti efter fx 7 dage.
- **[major] G6 – Nulstilling af adgangskode har ingen separat kodebekræftelse og bruger et 64-tegns token.**
  Appens flow er e-mail → kode → ny adgangskode (`verifyResetCode`). Ønske: kort numerisk kode
  (4–6 cifre, forsøgsgrænse) og `POST /auth/password/verify-code { email, code }` → 204/400 uden at
  bruge koden op. I dag validerer appen først ved `POST /auth/password/reset`. `ForgotPassword` sender
  desuden intet til ubekræftede konti (tavst 204).
- **[minor] G7 – Ingen maskinlæsbare fejlkoder.** `ProblemDetails` har kun engelsk `title`/`detail`, og de
  to 409-fejl ved register (e-mail/brugernavn) kan kun skelnes på teksten. Ønske:
  `extensions.code`, fx `email_taken`, `username_taken`, `invalid_credentials`,
  `email_not_verified`, `token_invalid`, `validation_failed`, og camelCase-nøgler i
  `ValidationProblemDetails.errors` (i dag `"Password"`, `"$.gender"`).
- **[minor] G8 – Login kun med e-mail.** `LoginRequest.Email` har `[EmailAddress]`, så et brugernavn
  giver 400. Designet viser "Brugernavn". Ønske: `{ emailOrUsername, password }`. (Appen skifter
  til e-mail, indtil det er afklaret.)
- **[minor] G9 – Adgangskoderegel 10 tegn vs. design 8.** Register/reset/change kræver min. 10.
  Bekræft, at 10 er det rigtige – appen følger API'et.
- **[minor] G10 – Profilgrænser afviger fra appen.** Højde 100–250 cm (appen 55–250) og alder 13–100
  (appen 16–120). Bekræft grænserne – appen følger API'et.
- **[minor] G11 – Træningsprofilen er grovere end appens.** API'et gemmer kun `trainingDaysPerWeek`
  (int), ikke **hvilke** ugedage (appen har 7 flag, og brugeren kan rette dem i profilen), og kun
  3 intensitetsniveauer, ikke RPE 1–10. `trainingIntensity` er desuden påkrævet, selv når
  `trainingDaysPerWeek = 0`. Ønske: `trainingDays: ("Monday"…"Sunday")[]` (eller bitmask),
  valgfri `trainingRpe: int 1–10` og nullable `trainingIntensity`, når der ikke er træningsdage.
- **[minor] G12 – Log ud kræver et gyldigt access-token.** `POST /auth/logout` er `[Authorize]`, så en
  app med udløbet access-token skal rotere refresh-tokenet først. Ønske: `[AllowAnonymous]` logout,
  der kun kræver `refreshToken`.
- **[minor] G13 – Intet felt til manuelt kaloriemål.** Appens `kcalOverride` (manuelt mål, der
  overstyrer det beregnede) findes ikke i API'et. Ønske: `targetDailyCaloriesOverride` på målet
  eller en `SettingKey`.
- **[minor] G14 – Brugernavn er unikt case-sensitivt** (`"Mads"` ≠ `"mads"`), mens e-mail normaliseres
  til små bogstaver. Ønske: case-insensitiv unikhed.
- **[minor] G15 – Ingen rate limiting på `resend-verification`, `password/forgot`, `email/verify` og
  `login`.** Det er nødvendigt, hvis G2/G6 indfører korte koder.
