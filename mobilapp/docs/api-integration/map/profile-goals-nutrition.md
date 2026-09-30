# Mapping: profil, mål, ernæringsmål og indstillinger

Domæne: `UserProfile` i appen ↔ `ProfileController`, `MeController`, `GoalsController`,
`NutritionController`, `SettingsController`, `MetadataController` (+ `WeightLogsController/latest`
for den aktuelle vægt).

Kilder, der er læst: `API/Program.cs`, `API/Controllers/{Profile,Me,Goals,Nutrition,Settings,Metadata,WeightLogs}Controller.cs`,
`API/DTOs/{Profile,Goals,Nutrition,Settings,Metadata,Auth,Common}/*`, `API/Services/{Profiles,Goals,Nutrition,Settings,Metadata}/*`,
`API/Services/Auth/{AuthService,UserAccountService}.cs`, `API/Domain/Enums/*`, `API/Domain/Entities/{User,UserProfile,UserGoal,UserSetting,WeightLog}.cs`,
`API/Utilities/{ProfileValidation,RequestGuards,EnumMappings}.cs`, `API/Exceptions/GlobalExceptionHandler.cs`, `API/Options/*`, `API/appsettings.json`.
App: `core/models/{profile,nutrition,theme,language,weight}.ts`, `core/constants/{profile-defaults,nutrition,weight,theme,language,storage-key}.ts`,
`core/services/{user-profile,nutrition-calculator,adaptive-goal,theme,language,auth-api,weight-log}/*`,
`features/profile/**`, `shared/components/profile-avatar/*`.

Verificeret mod den kørende dev-API (`http://localhost:5210`, containeren `fitnessapp-dev-api-1`):
`GET /api/v1/metadata` og `/swagger/v1/swagger.json` (begge anonyme; ingen skrivninger).

---

## 1. Generelle API-konventioner (gælder alle kald herunder)

| Emne           | Faktisk opførsel (fra koden)                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSON-navne     | ASP.NET-standard (`JsonSerializerDefaults.Web`): **camelCase** i svar, case-insensitive ved læsning. Ingen egen naming policy i `Program.cs`.                                                                                                                                                                                                                                                                         |
| Enums          | `JsonStringEnumConverter` **uden** naming policy → enum-**navne i PascalCase** i svar (`"Male"`, `"LoseWeight"`, `"Theme"`). Læsning accepterer navnet (case-insensitive) og også tal (`allowIntegerValues` er default `true`). `StringValueAttribute` bruges **ikke** til serialisering (kun på `AchievementType`, til visning). Send altid det præcise PascalCase-navn.                                             |
| `DateOnly`     | `"YYYY-MM-DD"` (`birthDate`, `date`).                                                                                                                                                                                                                                                                                                                                                                                 |
| `DateTime`     | ISO 8601, gemt som UTC (`createdAt`, `updatedAt`).                                                                                                                                                                                                                                                                                                                                                                    |
| `decimal`      | JSON-tal (`height`, `targetDailyCalories` med op til 2 decimaler, f.eks. `2081.86`).                                                                                                                                                                                                                                                                                                                                  |
| Auth           | Alle `/api/v1/me/**` kræver `Authorization: Bearer <access JWT>`. `OnTokenValidated` afviser tokenet, hvis brugeren ikke er `IsActive && EmailVerifiedAt != null && DeletedAt == null` → **401 på hvert kald, indtil e-mailen er bekræftet**. `/api/v1/metadata` er `[AllowAnonymous]`.                                                                                                                               |
| Fejl           | `ProblemDetails` `{ status, title, detail }`. `BusinessValidationException` → 400, `NotFoundException` → 404, `ConflictException` → 409, `UnauthorizedAccessException` → 403, `UnauthorizedException` → 401. Model binding-fejl (f.eks. ukendt enum-streng) → 400 `ValidationProblemDetails` med `errors`. `detail` er engelsk tekst – må ikke vises direkte (ARCHITECTURE §11); map status/kontekst til i18n-nøgler. |
| CORS           | **Ingen** `AddCors`/`UseCors` i `Program.cs`. En preflight `OPTIONS /api/v1/me/profile` mod dev-API'et svarer `405`. Browser-dev (`npm start`) kræver derfor en Angular dev-server-proxy; native kræver `CapacitorHttp` (eller CORS i API'et, se gaps).                                                                                                                                                               |
| Base-URL (dev) | `http://localhost:5210` (compose i docs/api-integration/docker, kun HTTP på 8080→5210). Android-emulator: `http://10.0.2.2:5210` (kræver cleartext-tilladelse).                                                                                                                                                                                                                                                       |

---

## 2. Endpoints i domænet

### 2.1 Konto – `MeController` (`api/v1/me`)

| Verb + route                 | Request                                                                                  | Response                                                                                                                     | Status                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `GET /api/v1/me`             | –                                                                                        | `UserDto { userId: int, email: string, username: string, isActive: bool, emailVerifiedAt: string\|null, createdAt: string }` | 200, 404                                  |
| `PATCH /api/v1/me`           | `UpdateAccountRequest { email?: string (EmailAddress, ≤320), username?: string (3–50) }` | `UserDto`                                                                                                                    | 200, 400, 409 (e-mail/brugernavn optaget) |
| `DELETE /api/v1/me`          | –                                                                                        | – (soft delete; sletter profil, mål, vejninger, logs, indstillinger, billede-nøgle m.m.)                                     | 204, 404                                  |
| `GET /api/v1/me/data-export` | –                                                                                        | `UserDataExportDto`                                                                                                          | 200                                       |

**Vigtigt om e-mailskift:** `PATCH /me` med en ny e-mail sætter `IsActive=false`, `EmailVerifiedAt=null` og
revoker alle refresh tokens (`UserAccountService.UpdateAsync`). Pga. `OnTokenValidated` fejler **selv det nuværende
access token** med det samme → brugeren er reelt logget ud, indtil den nye e-mail er bekræftet via
`POST /api/v1/auth/email/verify { token }`.

### 2.2 Profil – `ProfileController` (`api/v1/me/profile`)

| Verb + route                      | Request                                                                          | Response                                      | Status                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/v1/me/profile`          | –                                                                                | `UserProfileDto`                              | 200, 404 (ingen profil)                                                                   |
| `PUT /api/v1/me/profile`          | `UpsertUserProfileRequest` (alle felter; se nedenfor)                            | `UserProfileDto`                              | 200, 400                                                                                  |
| `PATCH /api/v1/me/profile`        | `PatchUserProfileRequest` (alle felter nullable; `null`/udeladt = uændret)       | `UserProfileDto`                              | 200, 400, 404                                                                             |
| `PUT /api/v1/me/profile/activity` | `UpdateActivityRequest { dailySteps: int, fromHealthIntegration: bool = false }` | `UserProfileDto`                              | 200, 400, 403 (hvis `fromHealthIntegration=true` uden aktivt `StepsIntegration`-samtykke) |
| `PUT /api/v1/me/profile/image`    | `multipart/form-data`, felt **`file`** (`File`; binding er case-insensitive)     | `ProfileImageDto { profileImageUrl: string }` | 200, 400, 404                                                                             |
| `GET /api/v1/me/profile/image`    | –                                                                                | **302 redirect** til blob-URL                 | 302, 404                                                                                  |
| `DELETE /api/v1/me/profile/image` | –                                                                                | –                                             | 204, 404 (intet billede)                                                                  |

`UserProfileDto`:

```
{ userProfileId: int, userId: int, birthDate: "YYYY-MM-DD", gender: Gender, height: number (cm),
  startingWeight: number (kg), dailySteps: int, trainingDaysPerWeek: int, workoutDurationMinutes: int,
  trainingIntensity: TrainingIntensity, timeZoneId: string, profileImageUrl: string | null }
```

`UpsertUserProfileRequest`: `{ birthDate, gender, height, dailySteps, trainingDaysPerWeek, workoutDurationMinutes, trainingIntensity, timeZoneId?: string|null }`
– ikke-nullable value types. Udelades et felt i PUT, bliver det `default` (dato `0001-01-01`, `trainingIntensity` 0 → 400
"A profile enum value is invalid."). **Brug PATCH fra appen.**
`PatchUserProfileRequest`: samme felter, alle nullable. Man kan ikke "nulstille" et felt med `null`; send en eksplicit værdi.

Validering (`ProfileValidation.Validate`, kaldes ved hver PUT/PATCH/activity):

- alder 13–100 år (fra `birthDate`)
- `height` 100–250 cm
- `startingWeight` 25–400 kg (sættes kun ved registrering; kan ikke ændres via profil-endpoints)
- `dailySteps` 0–100000
- `trainingDaysPerWeek` 0–7
- `workoutDurationMinutes` 0–480
- `gender`/`trainingIntensity` skal være definerede enum-værdier
- `timeZoneId` skal kunne findes af `TimeZoneInfo.FindSystemTimeZoneById` (send IANA, f.eks. `Europe/Copenhagen`)

Sideeffekt: hvis `birthDate`, `gender`, `height`, `dailySteps`, `trainingDaysPerWeek`, `workoutDurationMinutes` eller
`trainingIntensity` ændres, og brugeren har et mål, kører `RecalculateAsync(force: true)` i samme transaktion → **ny
`UserGoal`-række med nye kcal/makro-mål**. Profil-svaret indeholder ikke målet → appen skal hente
`GET /me/goals/current` bagefter.

Billedupload (`ProfileImageService.UploadAsync`): max `2097152` bytes (2 MB), kun JPEG/PNG/WebP, detekteret på
magic bytes; `file.ContentType` skal matche det detekterede format (en `Blob` med `type: 'image/jpeg'` giver det).
Gemmes i Azure Blob; svaret er en fuld URL med SAS-token (`{PublicBaseUrl}/{guid}.jpg?{sas}`). Det gamle billede slettes.
URL'en er også i `UserProfileDto.profileImageUrl`, så `GET /image` (redirect) er ikke nødvendig.

### 2.3 Mål – `GoalsController` (`api/v1/me/goals`)

| Verb + route                                   | Request                                                                                           | Response                                                                  | Status                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /api/v1/me/goals/current`                 | –                                                                                                 | `UserGoalDto` (nyeste efter `createdAt`, `userGoalId`)                    | 200, 404                                                           |
| `GET /api/v1/me/goals/at?at=<ISO datetime>`    | –                                                                                                 | `UserGoalDto` gældende på tidspunktet                                     | 200, 404                                                           |
| `GET /api/v1/me/goals/{goalId:int}`            | –                                                                                                 | `UserGoalDto`                                                             | 200, 404                                                           |
| `GET /api/v1/me/goals?from&to&limit=50&cursor` | –                                                                                                 | `CursorPage<UserGoalDto> { items, nextCursor, hasMore }` (limit maks 100) | 200, 400                                                           |
| `POST /api/v1/me/goals`                        | `CreateUserGoalRequest { goalType: GoalType, targetWeight: number, weightChangePerWeek: number }` | `UserGoalDto`                                                             | **201** (`CreatedAtAction`), 400, 409 (identisk med nuværende mål) |
| `POST /api/v1/me/goals/recalculate`            | –                                                                                                 | `UserGoalDto` (ny, eller den gamle hvis intet ændrede sig)                | 200, 400, 404 (intet mål)                                          |

`UserGoalDto`:

```
{ userGoalId: int, goalType: GoalType, targetWeight: number, weightChangePerWeek: number,
  targetDailyCalories: number, targetProtein: number, targetCarbohydrates: number, targetFat: number,
  createdAt: string }
```

Regler (`GoalCalculator.Calculate`):

- `targetWeight` og aktuel vægt 25–400 kg; `weightChangePerWeek` 0–1.
- `MaintainWeight`: `weightChangePerWeek` **skal være 0** og `targetWeight` **skal være præcis lig aktuel vægt**
  (= seneste `WeightLog.Weight`, ellers `startingWeight`). Decimal-lighed – send værdien fra
  `GET /me/weight-logs/latest` uændret.
- `LoseWeight`: `targetWeight < aktuel vægt` og pace > 0. `GainWeight`: `targetWeight > aktuel vægt` og pace > 0.
- Ingen profil → 400 "Complete the profile before setting a goal."
- Målet genberegnes automatisk ved profilændringer (se 2.2) **og** ved oprettelse/ændring/sletning af vejninger
  (`WeightLogService` kalder `RecalculateAsync(force: true)`). Når en tabe/tage-på-bruger når målvægten, skifter
  genberegningen selv `goalType` til `MaintainWeight`.

### 2.4 Ernæring – `NutritionController` (`api/v1/me/nutrition`)

| Verb + route                                                  | Response                                                             | Status                  |
| ------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- |
| `GET /api/v1/me/nutrition/today`                              | `NutritionDayDto` for "i dag" i profilens `timeZoneId`               | 200, 404 (ingen profil) |
| `GET /api/v1/me/nutrition/days/{date}` (`YYYY-MM-DD`)         | `NutritionDayDto`                                                    | 200                     |
| `GET /api/v1/me/nutrition/days?from=YYYY-MM-DD&to=YYYY-MM-DD` | `NutritionDayDto[]`; `to` er **eksklusiv**, 1–32 dage                | 200, 400                |
| `GET /api/v1/me/nutrition/history?from&to&limit&cursor`       | `CursorPage<NutritionHistoryItemDto { foodLog, goalAtConsumption }>` | 200, 400                |

`NutritionDayDto { date, consumed: NutritionTotalsDto, goal: UserGoalDto|null, remaining: NutritionTotalsDto|null }`,
`NutritionTotalsDto { calories, protein, carbohydrates, fat }`. `goal` er det mål, der gjaldt ved dagens slutning;
`remaining = goal − consumed` (kan være negativ). Der er **ingen** "recalculate" her – den ligger på `/goals/recalculate`.
Der er ingen antal-logninger pr. dag (appens `DailyFoodTotals.entryCount`).

### 2.5 Indstillinger – `SettingsController` (`api/v1/me/settings`)

| Verb + route                       | Request                                                        | Response                                                        | Status                    |
| ---------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------- |
| `GET /api/v1/me/settings`          | –                                                              | `UserSettingDto[]` – **kun gemte** nøgler, sorteret efter nøgle | 200                       |
| `GET /api/v1/me/settings/{key}`    | –                                                              | `UserSettingDto`                                                | 200, 400, 404 (ikke gemt) |
| `PUT /api/v1/me/settings/{key}`    | `UpsertUserSettingRequest { value: string (påkrævet, 1–500) }` | `UserSettingDto`                                                | 200, 400, 403             |
| `DELETE /api/v1/me/settings/{key}` | –                                                              | –                                                               | 204, 404                  |

`{key}` er `SettingKey`, bundet fra routen (navn, case-insensitive, eller tal): `Theme`, `Notifications`,
`MealReminders`, `WeightReminders`, `Language`, `WeightUnit`, `AllowStepsSharing`.
`UserSettingDto { settingKey: SettingKey, settingValue: string, updatedAt: string }`.

Værdivalidering (`UserSettingService.UpsertAsync`, værdien trimmes først):

- `Notifications`, `MealReminders`, `WeightReminders`, `AllowStepsSharing`: `bool.TryParse` → normaliseres til `"true"`/`"false"`.
  `AllowStepsSharing=true` kræver `StepsIntegration`-samtykke (ellers 403).
- `Theme`: præcis `"light"`, `"dark"` eller `"system"` (case-sensitive).
- `WeightUnit`: præcis `"kg"` eller `"lb"`.
- `Language`: 2–20 tegn, regex `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` → `"da"`/`"en"` er gyldige.

Registreringen gemmer kun `Notifications` (fra `RegisterRequest.notificationsEnabled`). Alle andre nøgler mangler,
til appen skriver dem → brug `GET /settings` (liste) og fald tilbage til appens defaults, i stedet for `GET /settings/{key}` (404).

### 2.6 Metadata – `GET /api/v1/metadata` (anonym)

Returnerer enum-navne (bekræftet mod dev-API'et):
`genders: [Unspecified, Male, Female, Other, PreferNotToSay]`, `trainingIntensities: [Low, Moderate, High]`,
`goalTypes: [LoseWeight, MaintainWeight, GainWeight]`, `settingKeys: [Theme, Notifications, MealReminders, WeightReminders, Language, WeightUnit, AllowStepsSharing]`, m.fl.
Kun navne, ingen labels/grænser. Appen har ikke brug for det i runtime; enum-tabellerne kan være konstanter.

### 2.7 Aktuel vægt – `GET /api/v1/me/weight-logs/latest`

`LatestWeightDto { weightLogId: int|null, weight: number, recordedAt: string, isStartingWeight: bool }` – falder tilbage
til `startingWeight`, når der ikke er nogen vejninger (`isStartingWeight: true`). 404 hvis ingen af delene findes.
Det er den vægt, `GoalCalculator` regner med.

---

## 3. Feltmapping: app `UserProfile` ↔ API

| App-felt (`core/models/profile.ts`)                           | API-kilde (læs)                                                | API-skrivning                                                                                        | Mapping / bemærkning                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `username`                                                    | `GET /me` → `username`                                         | `PATCH /me { username }`                                                                             | 3–50 tegn, **unik** (409). Appen bruger det som visningsnavn.                                                                                                                                                                                       |
| `email`                                                       | `GET /me` → `email`                                            | `PATCH /me { email }`                                                                                | E-mailskift låser brugeren ude til verifikation (se 2.1).                                                                                                                                                                                           |
| `birthday` (`string\|null`)                                   | `profile.birthDate`                                            | `PATCH /me/profile { birthDate }`                                                                    | Samme format `YYYY-MM-DD`. API kræver en dato; `null` kan ikke gemmes. App-grænser 16–120 år, API 13–100 → 101–120 afvises af API'et.                                                                                                               |
| `gender` (`'mand'\|'kvinde'\|'andet'\|null`)                  | `profile.gender`                                               | `PATCH { gender }`                                                                                   | Se enum-tabel. `null` ↔ `Unspecified`.                                                                                                                                                                                                              |
| `heightCm`                                                    | `profile.height`                                               | `PATCH { height }`                                                                                   | Edit-ark 120–230 ok. Signup-linealen tillader 55–99 (`HEIGHT_MIN_CM=55`), som API'et afviser (min 100).                                                                                                                                             |
| `weightKg`                                                    | `GET /me/weight-logs/latest` → `weight`                        | **Ikke via profil** – kun via weight-logs (`POST /me/weight-logs`)                                   | `profile.startingWeight` er kun startvægten. Hver vejning genberegner målet på serveren.                                                                                                                                                            |
| `stepsPerDay`                                                 | `profile.dailySteps`                                           | `PUT /me/profile/activity { dailySteps, fromHealthIntegration: false }` eller `PATCH { dailySteps }` | App 0–50000 ⊂ API 0–100000.                                                                                                                                                                                                                         |
| `trainingDays` (7 × bool, mandag først)                       | `profile.trainingDaysPerWeek`                                  | `PATCH { trainingDaysPerWeek }`                                                                      | **Tabsgivende**: API gemmer kun antallet. API→app: de første N dage sat til `true` (som `trainingDaysFor()` i `profile-edit.ts`). Hvilke ugedage går tabt.                                                                                          |
| `trainingMinutes`                                             | `profile.workoutDurationMinutes`                               | `PATCH { workoutDurationMinutes }`                                                                   | App 10–180 ⊂ API 0–480.                                                                                                                                                                                                                             |
| `trainingRpe` (1–10 \| `null`)                                | `profile.trainingIntensity`                                    | `PATCH { trainingIntensity }`                                                                        | **Tabsgivende**: 1–4 → `Low`, 5–7 → `Moderate`, 8–10 → `High` (appens `INTENSITIES[].maxRpe`); API→app: `Low`→3, `Moderate`→6, `High`→9 (`INTENSITIES[].rpe`). `null` kan ikke sendes; brug `TRAINING_FALLBACK_INTENSITY` (`moderat` → `Moderate`). |
| `goal` (`'tabe'\|'hold'\|'tage'\|null`)                       | `GET /me/goals/current` → `goalType`                           | `POST /me/goals`                                                                                     | Se enum-tabel. Et mål oprettes altid ved registrering, så `null` forekommer ikke efter login.                                                                                                                                                       |
| `pace` (`'rolig'\|'moderat'\|'hurtig'\|null`)                 | `goal.weightChangePerWeek`                                     | `POST /me/goals { weightChangePerWeek }`                                                             | `rolig`↔0.25, `moderat`↔0.5, `hurtig`↔1.0 (`PACES[].kgPerWeek`). `MaintainWeight` tvinger 0 → tempo går tabt ved skift til "hold" og tilbage. Andre værdier fra API → nærmeste tempo.                                                               |
| `goalWeightKg`                                                | `goal.targetWeight`                                            | `POST /me/goals { targetWeight }`                                                                    | Ved `hold` skal `targetWeight` = aktuel vægt præcis (API overskriver appens gemte målvægt).                                                                                                                                                         |
| `notificationsEnabled`                                        | setting `Notifications` (`"true"/"false"`)                     | `PUT /me/settings/Notifications { value }`                                                           | 1:1. Gemmes allerede ved registrering.                                                                                                                                                                                                              |
| `units` (`'metrisk'\|'imperial'`)                             | setting `WeightUnit` (`"kg"/"lb"`)                             | `PUT /me/settings/WeightUnit`                                                                        | `metrisk`↔`kg`, `imperial`↔`lb`. API kender kun vægtenheden (appens tekst siger "lb · in"). Mangler nøglen → `metrisk`.                                                                                                                             |
| `kcalOverride` (`number\|null`)                               | –                                                              | –                                                                                                    | **Findes ikke i API'et** (ingen felt på mål, ingen fri `SettingKey`). Se gaps.                                                                                                                                                                      |
| `photo` (`ProfilePhoto { dataUrl, aspectRatio, zoom, x, y }`) | `profile.profileImageUrl`                                      | `PUT/DELETE /me/profile/image`                                                                       | API gemmer kun selve billedfilen, **ikke** beskæringen. Se afsnit 6.                                                                                                                                                                                |
| – (kun API)                                                   | `profile.timeZoneId`                                           | `PATCH { timeZoneId }`                                                                               | Appen har intet felt. Send `Intl.DateTimeFormat().resolvedOptions().timeZone` ved login/ændring; bruges til dagsgrænser i `/nutrition/*`.                                                                                                           |
| – (kun API)                                                   | `profile.startingWeight`                                       | – (kun ved registrering)                                                                             | Kan bruges som "startvægt" på Hjem (`home-summary.ts` bruger i dag den ældste vejning).                                                                                                                                                             |
| – (kun API)                                                   | `userId`, `userProfileId`, `goal.userGoalId`, `goal.createdAt` | –                                                                                                    | Ikke nødvendige i UI'et.                                                                                                                                                                                                                            |

Afledte værdier i `UserProfileService` (`age`, `bmi`, `activityLevel`, `trainingFrequency`, `intensity`,
`goalDefinition`, `paceDefinition`) fortsætter uændret ud fra det mappede profil-objekt.

### Enum-mapping

| App                             | API                                    | Retning / bemærkning                                    |
| ------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| `gender: 'mand'`                | `Male`                                 | ↔                                                       |
| `gender: 'kvinde'`              | `Female`                               | ↔                                                       |
| `gender: 'andet'`               | `Other`                                | ↔                                                       |
| `gender: null`                  | `Unspecified`                          | ↔ (begge giver −78 i BMR på begge sider)                |
| –                               | `PreferNotToSay`                       | API→app: `null` (vises som "–")                         |
| `goal: 'tabe'`                  | `LoseWeight`                           | ↔                                                       |
| `goal: 'hold'`                  | `MaintainWeight`                       | ↔                                                       |
| `goal: 'tage'`                  | `GainWeight`                           | ↔                                                       |
| `trainingRpe` 1–4 / 5–7 / 8–10  | `Low` / `Moderate` / `High`            | API→app: 3 / 6 / 9                                      |
| `pace` rolig / moderat / hurtig | `weightChangePerWeek` 0.25 / 0.5 / 1.0 | API→app: nærmeste; 0 → behold appens sidst kendte tempo |
| `Theme` `'dark'` / `'light'`    | `"dark"` / `"light"`                   | API `"system"` → appens `DEFAULT_THEME` (`dark`)        |
| `Language` `'da'` / `'en'`      | `"da"` / `"en"`                        | ukendt værdi → `DEFAULT_LANGUAGE`                       |
| `units` metrisk / imperial      | `WeightUnit` `"kg"` / `"lb"`           | ↔                                                       |

---

## 4. Kalorie- og makromål: API vs. app

**API'et beregner målene selv** (`GoalCalculator`), gemmer dem på `UserGoal` og returnerer dem i
`UserGoalDto` og `NutritionDayDto.goal/remaining`. Appen beregner i dag sine egne (`NutritionCalculator` +
`AdaptiveGoalService`). **De to formler er forskellige og giver forskellige tal.**

| Del               | App (`NutritionCalculator`)                                         | API (`GoalCalculator`)                                                            |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| BMR               | Mifflin-St Jeor, køn +5 / −161 / −78; manglende alder → 30 år       | Samme formel og samme konstanter; alder er påkrævet                               |
| Aktivitet         | PAL-trin efter skridt: 1.25 / 1.4 / 1.55 / 1.7 / 1.85 / 1.95        | `1.2 + min(skridt/10000 × 0.30, 0.45)`                                            |
| Træning           | Lagt oveni: `dage × min × (MET − 1) × kg / 60 / 7`, MET 3.5 / 5 / 8 | Lagt i multiplieren: `dage × min / 420 × {0.08, 0.12, 0.16}`; multiplier maks 2.4 |
| Mål-justering     | Fast kcal/dag: 250 / 500 / 1000                                     | `kg/uge × 7700 / 7` → 275 / 550 / 1100                                            |
| Gulv              | 1200 kcal for alle                                                  | 1500 for `Male`, ellers 1200                                                      |
| Afrunding         | Nærmeste 10 kcal                                                    | 2 decimaler                                                                       |
| Makrofordeling    | 30 / 45 / 25 (protein / kulhydrat / fedt), hele gram                | 30 / 40 / 30, 2 decimaler                                                         |
| Adaptiv justering | Ja, ±300 kcal ud fra 21 dages indtag + vægttrend                    | **Nej**                                                                           |
| Manuelt kcal-mål  | `kcalOverride`                                                      | **Nej**                                                                           |

Eksempler (beregnet med begge formler):

| Profil                                                                      | App kcal / P / K / F  | API kcal / P / K / F               |
| --------------------------------------------------------------------------- | --------------------- | ---------------------------------- |
| Mand 30 år, 80 kg, 180 cm, 8000 skridt, 3×45 min moderat, tabe 0,5 kg/uge   | 2360 / 177 / 266 / 66 | 2081.86 / 156.14 / 208.19 / 69.40  |
| Kvinde 28 år, 65 kg, 168 cm, 6000 skridt, 2×30 min mild, holde vægten       | 2190 / 164 / 246 / 61 | 1946.61 / 146.00 / 194.66 / 64.89  |
| Mand 25 år, 70 kg, 178 cm, 12000 skridt, 5×60 min hård, tage på 0,25 kg/uge | 3480 / 261 / 392 / 97 | 3108.73 / 233.15 / 310.87 / 103.62 |

Forskellen er 240–370 kcal/dag. Når madloggen flyttes til API'et, regnes `remaining` på serveren ud fra
API-målet. Viser appen sit eget mål, passer "tilbage i dag" ikke med serverens tal.

**kcal-override:** Kan ikke gemmes i API'et. `SettingKey` er et lukket enum, og de nøgler, der er, har faste
værdiformater. Der er heller intet felt på `CreateUserGoalRequest`/`UserGoal`.

**Adaptivt mål:** API'et har alle data (madlog + vejninger), men beregner ikke noget adaptivt.
`GET /nutrition/days?from&to` (maks 32 dage) kan give appen de 21 dage i ét kald, men uden `entryCount`.
`calories > 0` plus appens eksisterende 50 %-filter er en brugbar erstatning.

**Anbefaling (skal besluttes af Janick/API-teamet, se gaps):** Lad API-målet være sandheden for kcal og makroer
(`goal.targetDailyCalories`, `targetProtein`, `targetCarbohydrates`, `targetFat`, afrundet til hele tal i visningen).
Indtil API'et understøtter override og adaptiv justering:

- `kcalOverride` gemmes kun lokalt (pr. enhed, `StorageService`) og vises som i dag.
- Den adaptive justering beregnes fortsat i klienten med API-data som input. `formulaTdeeKcal` udledes af API-målet
  (`targetDailyCalories ± weightChangePerWeek × 1100`). Makroerne skaleres proportionalt fra API-målets gram
  (`gram × kcalTarget / targetDailyCalories`), så API'ets 30/40/30-fordeling bevares.
- "Tilbage" regnes i klienten (`kcalTarget − consumed.calories`) i stedet for at bruge `remaining`, når override eller
  justering er aktiv.
- Forhåndsvisninger før der findes en konto (signup-resuméet, edit-arkets hint) bør bruge en port af `GoalCalculator`
  i `NutritionCalculator`. Så viser appen det samme tal, som serveren gemmer ved registreringen.

---

## 5. Tema, sprog og notifikationer

- **Tema:** `SettingKey.Theme` findes. Appens `'dark' | 'light'` er en delmængde af API'ets `light|dark|system`.
  `ThemeService.set()` skriver lokalt (så login-skærme og første frame virker før auth) og kalder
  `PUT /me/settings/Theme { value }`. Efter login: læs `GET /me/settings` og anvend `Theme`, hvis den findes.
- **Sprog:** `SettingKey.Language` findes, og `"da"`/`"en"` består regex'en. Samme mønster som tema.
- **Notifikationer:** `SettingKey.Notifications` (bool-streng). `ReminderService.setMasterEnabled()` → `PUT /me/settings/Notifications`.
  (`MealReminders`/`WeightReminders` findes også som booleans – hører til reminder-domænet.)
- **Enheder:** `SettingKey.WeightUnit` (`kg|lb`) ↔ `units`.

---

## 6. Profilbillede

- Format: **multipart/form-data**, feltet `file`, JPEG/PNG/WebP ≤ 2 MB. Ikke base64.
- Svar: `{ profileImageUrl }`, en absolut HTTPS-URL med SAS-token til Azure Blob. Kan bruges direkte i
  `background-image: url(...)` (der kræves ikke CORS for at vise billeder).
- Appen producerer i dag en JPEG-data-URL (maks 768 px, kvalitet 0.8) og gemmer beskæringen
  (`zoom`, `x`, `y`, `aspectRatio`) ved siden af. API'et gemmer **ikke** beskæringen.
- Løsning uden API-ændring: bag beskæringen ind i billedet med canvas (kvadratisk JPEG, f.eks. 512×512), når brugeren
  trykker "Brug billedet", og upload det. Fra API: `ProfilePhoto { dataUrl: profileImageUrl, aspectRatio: 1, zoom: 1, x: 50, y: 50 }`
  (eller omdøb `dataUrl` → `src`). Arket skal ændres fra "gem live ved hver drag/zoom" til "upload ved bekræft", med
  loading- og fejltilstand. Ulempe: brugeren kan ikke beskære originalen igen senere.
- "Fjern foto" → `DELETE /me/profile/image` (204; 404 hvis der allerede ikke er noget – håndtér som succes).

---

## 7. Gaps til API-teamet

- **[major] Forskellige kalorie-/makroformler.** API'ets `GoalCalculator` og appens `NutritionCalculator` giver
  240–370 kcal/dag forskellige mål (aktivitetsmodel, træning, 1100 vs. 500 kcal/dag ved 0,5 kg/uge, gulv 1500 for mænd,
  makro 30/40/30 vs. 30/45/25). Vælg én formel. Enten tager API'et appens formel (PAL-trin efter skridt + MET-baseret
  træning + faste 250/500/1000 kcal pr. tempo + 30/45/25), eller også accepterer produktet API'ets tal, og appen porter dem.
- **[major] Manuelt kaloriemål (`kcalOverride`) kan ikke gemmes.** Forslag: `decimal? CalorieOverride` på
  `UserGoal`/`CreateUserGoalRequest`/`UserGoalDto`, hvor makroerne beregnes ud fra override'n, når den er sat. Alternativt en ny
  `SettingKey.CalorieTargetOverride` (heltal 1200–5000, eller slettet = ingen), som `NutritionService` bruger i `remaining`.
- **[major] Intet adaptivt mål.** Appen justerer målet ±300 kcal ud fra 21 dages indtag og vægttrend (least squares).
  API'et har dataene, men `remaining` og `goal` tager ikke højde for det. Forslag: beregn det i `NutritionService`/`UserGoalService`
  og returnér f.eks. `adaptiveAdjustmentCalories` og `estimatedTdee` på `UserGoalDto` eller `NutritionDayDto`.
- **[major] E-mailskift logger brugeren ud med det samme.** `PATCH /api/v1/me { email }` sætter `IsActive=false`/`EmailVerifiedAt=null`,
  og `OnTokenValidated` afviser så også det nuværende access token. Brugeren kan ikke se sin profil, før den nye adresse er bekræftet.
  Forslag: "pending email" – behold den gamle e-mail aktiv, gem `PendingEmail`, og skift først ved verifikation.
- **[major, tværgående] Ingen CORS.** `Program.cs` har ingen `AddCors`/`UseCors` (preflight → 405). Capacitor-WebViews
  (`capacitor://localhost` på iOS, `https://localhost` på Android) og `http://localhost:4200` i dev bliver blokeret.
  Appen kan omgå det med dev-proxy og `CapacitorHttp`, men en CORS-policy for de origins er den rene løsning.
- **[minor] Vedligeholdelsesbehov (TDEE) mangler på målet.** `UserGoalDto` har kun det justerede `targetDailyCalories`.
  Tilføj `maintenanceCalories` (BMR × multiplier), så klienten kan vise "vedligehold" og beregne adaptivt/forhåndsvise uden at gætte baglæns.
- **[minor] Træningsdage gemmes kun som antal.** Appen gemmer, hvilke ugedage (7 × bool, mandag først). Forslag: `TrainingWeekdays`
  (bitmask 0–127 eller `DayOfWeek[]`) på profilen ved siden af `TrainingDaysPerWeek`.
- **[minor] Træningsintensitet har kun 3 niveauer.** Appen gemmer RPE 1–10. Forslag: valgfrit `TrainingRpe` (1–10) på profilen, med `TrainingIntensity` afledt.
- **[minor] Tempo går tabt ved "holde vægten".** `MaintainWeight` kræver `weightChangePerWeek = 0` og `targetWeight = aktuel vægt`, så brugerens
  valgte tempo og målvægt glemmes ved skift til "hold" og tilbage. Forslag: tillad at gemme det foretrukne tempo/målvægt, eller ignorér
  `weightChangePerWeek`/`targetWeight` for `MaintainWeight` i stedet for at afvise dem med 400.
- **[minor] `MaintainWeight` kræver præcis decimal-lighed med serverens aktuelle vægt.** Klienten skal først hente `/weight-logs/latest`.
  Forslag: lad serveren selv sætte `targetWeight = currentWeight` for `MaintainWeight` (som `RegisterAsync` og `RecalculateAsync` allerede gør).
- **[minor] Beskæring af profilbilledet gemmes ikke.** Forslag: valgfrie `CropZoom` (1–3), `CropX`/`CropY` (0–100) og `AspectRatio` i
  multipart-requesten, returneret i `UserProfileDto`. Ellers bager appen beskæringen ind og mister muligheden for at beskære originalen igen.
- **[minor] Højde- og aldersgrænser passer ikke med appen.** API: højde 100–250 cm og alder 13–100. Appens signup-lineal tillader 55–250 cm
  og 16–120 år. Enten retter appen sine grænser (nemmest: `HEIGHT_MIN_CM` → 100, `MAX_AGE` → 100), eller også dokumenterer/ændrer API-teamet grænserne.
- **[minor] Ingen samlet "min profil"-læsning.** Appens profil-objekt kræver 5 kald ved opstart: `/me`, `/me/profile`, `/me/goals/current`,
  `/me/settings`, `/me/weight-logs/latest`. Forslag: `GET /api/v1/me/summary`, som returnerer dem samlet.
- **[minor] `PATCH /me/profile` returnerer ikke det genberegnede mål.** Det kræver et ekstra `GET /me/goals/current` hver gang.
  Forslag: returnér `{ profile, goal }` eller tilføj `currentGoal` til `UserProfileDto`.
- **[minor] Højdeenhed mangler i indstillinger.** Kun `WeightUnit` (`kg|lb`) findes. Appens "Imperial" dækker også tommer (`lb · in`).
  Forslag: `SettingKey.HeightUnit` (`cm|in`) eller en samlet `UnitSystem` (`metric|imperial`).
- **[minor] `NutritionDayDto` mangler antal logninger pr. dag.** Appens adaptive beregning bruger `entryCount` til at springe tomme dage over.
  Forslag: `entryCount: int` på `NutritionDayDto`.
- **[minor, test] Dev-containeren uploader profilbilleder til den rigtige Azure-container.** `appsettings.json` peger på
  `https://fitnessapp.blob.core.windows.net/profilepictures` med SAS, og compose overstyrer det ikke. Options-valideringen kræver HTTPS,
  så Azurite over HTTP kan ikke bruges. Forslag: en `IProfileImageStorage` til lokal filopbevaring i Development.

---

## 8. Implementeringsplan (app-siden, API'et ændres ikke)

Mål: mindst mulig ændring af kaldende kode. `UserProfileService` beholder sit signal-API. Kun dens persistens skiftes
fra `StorageService` til HTTP, med localStorage som cache for første frame og offline.

1. **Konfiguration og konstanter** (`core/constants/api.ts`)
   - `API_BASE_URL`-`InjectionToken` (dev: `''` bag Angular-proxy; native: `http://10.0.2.2:5210` / miljøværdi).
   - `API_PATH` med alle ruter som konstanter (ingen magic strings): `ME`, `PROFILE`, `PROFILE_ACTIVITY`, `PROFILE_IMAGE`,
     `GOALS`, `GOALS_CURRENT`, `NUTRITION_TODAY`, `NUTRITION_DAYS`, `SETTINGS`, `WEIGHT_LATEST`.
   - `API_SETTING_KEY = { THEME: 'Theme', LANGUAGE: 'Language', NOTIFICATIONS: 'Notifications', WEIGHT_UNIT: 'WeightUnit' }`.
   - Enum-tabeller: `GENDER_TO_API`, `GENDER_FROM_API`, `GOAL_TO_API`, `GOAL_FROM_API`, `INTENSITY_TO_API` (RPE → niveau via
     `INTENSITIES`), `UNITS_TO_WEIGHT_UNIT`.
   - Dev: `proxy.conf.json` (`/api` → `http://localhost:5210`) i `angular.json` → `serve.options.proxyConfig`. Native: slå
     `CapacitorHttp` til i `capacitor.config.ts` (eller vent på CORS i API'et).

2. **Backend-typer** (`core/models/api/profile-api.ts`): `ApiUserDto`, `ApiUserProfileDto`, `ApiPatchUserProfileRequest`,
   `ApiUserGoalDto`, `ApiCreateUserGoalRequest`, `ApiUserSettingDto`, `ApiLatestWeightDto`, `ApiNutritionDayDto`,
   `ApiNutritionTotalsDto`, `ApiGender`, `ApiGoalType`, `ApiTrainingIntensity`, `ApiSettingKey` – præcis som i afsnit 2.
   Holdes adskilt fra UI-modellerne (ARCHITECTURE §8).

3. **HTTP-klient** (`core/services/profile-api/profile-api.ts`): en tynd `HttpClient`-wrapper, én metode pr. endpoint
   (`getMe`, `patchMe`, `getProfile`, `patchProfile`, `putActivity`, `uploadImage(blob)`, `deleteImage`, `getCurrentGoal`,
   `createGoal`, `getSettings`, `putSetting`, `getLatestWeight`, `getNutritionDays`). Ingen mapping og ingen state her.
   Upload: `const form = new FormData(); form.append('file', blob, 'avatar.jpg');`.

4. **Mapper** (`core/services/user-profile/profile-mapper.ts`, rene funktioner):
   - `toUserProfile(me, profile, goal, settings, latestWeight, local)` → `UserProfile` (`local` giver
     `kcalOverride`, ugedagsmønster, RPE og tempo, som API'et ikke kan gemme; bruges kun når API-værdien stadig passer,
     f.eks. `local.trainingDays` når antallet af `true` = `trainingDaysPerWeek`).
   - `toProfilePatch(patch: Partial<UserProfile>)` → `ApiPatchUserProfileRequest | null`.
   - `toCreateGoal(profile, currentWeightKg)` → `ApiCreateUserGoalRequest` (hold ⇒ `targetWeight = currentWeightKg`, pace 0).
   - `toTargets(goal)` → `Macros` (afrundet).

5. **`UserProfileService`**
   - `load(): Observable<void>` – `forkJoin` af de 5 GET-kald efter login/app-start med gyldig session, mapper, `state.set()`,
     skriver cache. Loading- og fejlsignal til UI'et.
   - `update(patch)` → `Observable<void>`, som sender hvert felt til sit endpoint:
     profilfelter → `PATCH /me/profile` og derefter `GET /me/goals/current`; `stepsPerDay` alene → `PUT /me/profile/activity`;
     `goal`/`pace`/`goalWeightKg` → `POST /me/goals` (409 = allerede gemt = succes); `notificationsEnabled`/`units` → `PUT /me/settings/{key}`;
     `username`/`email` → `PATCH /me` (ved e-mailskift: gå til verifikationsflowet); `kcalOverride` → kun lokalt.
     Pessimistisk: state opdateres først efter 2xx, så arket kan vise loading og fejl (som `updatePersisted` gør i dag).
   - Nyt signal `targets: Signal<Macros | null>` og `goal: Signal<ApiUserGoalDto | null>` fra `/goals/current`.
   - `weightKg` sættes stadig af `WeightLogService` – efter hver vejning skal `/goals/current` hentes igen, fordi serveren genberegner.

6. **`AdaptiveGoalService` / `NutritionCalculator`** (efter beslutningen i afsnit 4):
   - Basismål = `goal.targetDailyCalories` (afrundet). `kcalTarget = kcalOverride ?? basis + justering`.
   - `formulaTdeeKcal` = API-mål ± `weightChangePerWeek × 1100` (indtil `maintenanceCalories` findes).
   - Makroer: API-gram skaleret med `kcalTarget / targetDailyCalories` (erstatter `macroGoals()` til visning).
   - Port `GoalCalculator` til `NutritionCalculator.suggestedKcalTarget` for forhåndsvisninger før der findes en konto, og
     opdatér `nutrition-calculator.spec.ts` med API-eksemplerne ovenfor som golden values.

7. **`features/profile/services/profile-edit.ts`**: `applyOption`/`applyNumber`/`applyEmail`/`applyGoalWithGoalWeight`
   returnerer `Observable` (eller et `Promise`) i stedet for `boolean`. `profile-edit-sheet` viser loading, deaktiverer "Gem" og viser fejl via
   `UiFormError` med nye i18n-nøgler i `da.json`/`en.json`. Stram grænserne til API'ets: højde ≥ 100 (signup), alder ≤ 100.

8. **Foto** (`profile-photo-sheet.ts`): beskær til kvadratisk canvas-JPEG, når brugeren bekræfter → `uploadImage` → gem
   `profileImageUrl` i `photo`. "Fjern" → `deleteImage`. `ProfileAvatar`/`photo-crop.ts` virker uændret med en http-URL.

9. **`ThemeService` / `LanguageService`**: `set()` skriver lokalt som i dag og kalder derudover `PUT /me/settings/Theme|Language`,
   når der er en session. Ved `load()` anvendes serverens værdi (`system` → `dark`). Fejl logges og vises ikke. Lokal storage er stadig
   kilden før login.

10. **Konto-sletning** (`SessionService.deleteAccount()`): `DELETE /api/v1/me` (204) før den lokale oprydning, som README'en allerede beskriver.

11. **Tests**
    - `profile-api.spec.ts` med `HttpTestingController`: præcise URL'er, verbs, bodies (PascalCase-enums, `YYYY-MM-DD`) og multipart-feltet `file`.
    - `profile-mapper.spec.ts`: alle enum-tabeller begge veje, RPE ↔ intensitet, træningsdage-fallback, hold ⇒ `targetWeight = current`.
    - `user-profile.spec.ts`: `update()` rammer det rigtige endpoint pr. felt; 409 på `POST /goals` = succes; mål genhentes efter PATCH.
    - Opdatér `adaptive-goal.spec.ts`, `profile-edit.spec.ts`, `profile-edit-sheet.spec.ts`, `profile-photo-sheet.spec.ts`, `theme.spec.ts`, `language.spec.ts`.
    - UI-test i browseren mod dev-API'et bag proxy'en: log ind med en testbruger → ret højde → kaloriemålet ændrer sig (serveren genberegnede) →
      skift tema/sprog → genindlæs → værdien kommer tilbage fra `/me/settings`. **Undlad billedupload mod containeren**, indtil Azure er overstyret (se gaps).
    - Testbrugere kræver e-mailverifikation. I Development skriver `AccountMessageSender` mails som filer i `.dev-outbox`, og compose'en mounter den som `docs/api-integration/docker/outbox` – verifikationstokenet kan læses derfra.
