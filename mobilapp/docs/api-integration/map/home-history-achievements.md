# Mapping: Hjem, Historik og Præstationer ↔ FitnessApp API

Omfang: `features/home/**`, `features/history/**`, `features/profile/services/achievements.ts`

- `components/achievements/*`, `core/services/adaptive-goal/*` mod API'ets
  `HistoryController`, `AchievementsController`, `NutritionController` (+ de lister, de skærme
  reelt har brug for: `food-logs`, `weight-logs`, `goals`, `profile`).

Kilde: C#-koden i `/Users/janick/Documents/GitHub/FitnessApp/API` (læst, ikke ændret) og
**verificeret live** mod dev-containeren `fitnessapp-dev-api-1` på `http://localhost:5210`
(test-konto oprettet via register → outbox-token → verify → login; oplysningerne ligger i
`docs/api-integration/map/hha/account.env`, de gentages ikke her). Alle JSON-eksempler nedenfor er
rigtige svar fra containeren.

---

## 0. Fælles regler for API'et (gælder alle endpoints herunder)

| Emne        | Faktisk opførsel (kode + live)                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base        | `api/v1`. Alle `me/*`-routes kræver `Authorization: Bearer <accessToken>` (`[Authorize]`).                                                                                                                                                                                                                                                                                                       |
| JSON-navne  | ASP.NET-default **camelCase** (ingen `PropertyNamingPolicy` sat i `Program.cs`).                                                                                                                                                                                                                                                                                                                 |
| Enums       | `JsonStringEnumConverter` i `Program.cs` → enums serialiseres som **enum-navnet** (`"FirstMeal"`, `"GoalUpdated"`, `"LoseWeight"`, `"Gram"`). `[StringValue]` påvirker **ikke** JSON – den bruges kun til `AchievementDto.name`. Route-/query-binding accepterer både navn og tal (`/me/achievements/1` = `FirstMeal`).                                                                          |
| Tider       | Alle `DateTime`-kolonner er `timestamp with time zone` → UTC med `Z`, op til 6 decimaler (`"2026-09-30T06:26:49.580475Z"`). `new Date(...)` i JS parser dem korrekt.                                                                                                                                                                                                                             |
| Datoer      | `DateOnly` → `"YYYY-MM-DD"`.                                                                                                                                                                                                                                                                                                                                                                     |
| Decimaler   | `decimal` → JSON-tal, fx `555.00`, `2105.51`, `84.60`. Appen skal selv runde til visning.                                                                                                                                                                                                                                                                                                        |
| Cursor-side | `CursorPage<T>` = `{ items: T[], nextCursor: string \| null, hasMore: boolean }`. `limit` ≤ 0 → 50, loftet er **100** (stille – `limit=500` giver 100).                                                                                                                                                                                                                                          |
| Intervaller | `from` inklusiv, `to` **eksklusiv**. `from >= to` → 400 `"'from' must be earlier than 'to'…"`. `DateTime` uden `Z` tolkes som UTC (`RequestGuards.NormalizeUtc`).                                                                                                                                                                                                                                |
| Fejl        | `GlobalExceptionHandler` → `ProblemDetails` `{ title, status, detail }` (+ `existingWeightLogId` ved vægt-konflikt). Model-binding-fejl → `ValidationProblemDetails` `{ title, status, errors: { felt: [..] }, traceId }`. 401 har **tom body** (`WWW-Authenticate: Bearer`). 404 fra `NotFound()` er ProblemDetails uden `detail`.                                                              |
| Tidszone    | API'et deler dage op efter **profilens `timeZoneId`** (`UserProfile.TimeZoneId`, default `"UTC"`). Appen deler op efter enhedens tidszone. Profilens `timeZoneId` skal derfor holdes lig `Intl.DateTimeFormat().resolvedOptions().timeZone` (sættes ved register og via `PATCH /me/profile`). Verificeret: en post kl. `2026-09-29T22:30:00Z` tælles med på **30. sep** for `Europe/Copenhagen`. |
| CORS        | **Ingen CORS** i `Program.cs`. Preflight `OPTIONS` giver `405`. Browser (`ng serve`) og WebView kan ikke kalde API'et direkte → dev-proxy (`/api → http://localhost:5210`) til `ng serve` og `CapacitorHttp` (patcher `fetch`, som `withFetch()` bruger) på native.                                                                                                                              |
| Dashboard   | `DashboardController.cs` og `AchivementController.cs` er tomme stubs (`namespace API.Controllers`, arver ikke `ControllerBase`) → **ingen routes**. Der findes intet samlet Hjem-endpoint.                                                                                                                                                                                                       |

---

## 1. Endpoints i dette domæne (præcis form)

### 1.1 `GET /api/v1/me/nutrition/days?from=YYYY-MM-DD&to=YYYY-MM-DD` → `NutritionDayDto[]`

- `from`/`to` er `DateOnly` (kræves), `to` eksklusiv, **1–32 dage** ellers 400
  `"Day ranges must contain 1–32 days; 'to' is exclusive."` (også `from == to`).
- Én række pr. dag, **også dage uden poster** (så `consumed` er nuller).
- `goal` = målet, der gjaldt den dag (seneste `UserGoal` med `createdAt < dagens slutning`),
  `null` før brugerens første mål. `remaining = goal.target* − consumed`, `null` uden mål.
- 404 `"Profile not found."` hvis brugeren ikke har profil (kan ikke ske efter register).

```json
{
  "date": "2026-09-30",
  "consumed": { "calories": 1110.0, "protein": 39.0, "carbohydrates": 180.0, "fat": 21.0 },
  "goal": {
    "userGoalId": 4,
    "goalType": "LoseWeight",
    "targetWeight": 80.0,
    "weightChangePerWeek": 0.5,
    "targetDailyCalories": 2105.51,
    "targetProtein": 157.91,
    "targetCarbohydrates": 210.55,
    "targetFat": 70.18,
    "createdAt": "2026-09-30T06:27:17.967365Z"
  },
  "remaining": { "calories": 995.51, "protein": 118.91, "carbohydrates": 30.55, "fat": 49.18 }
}
```

### 1.2 `GET /api/v1/me/nutrition/today` → `NutritionDayDto` · `GET /api/v1/me/nutrition/days/{date}` → `NutritionDayDto`

Samme form som 1.1. `today` beregnes i profilens tidszone.

### 1.3 `GET /api/v1/me/nutrition/history?from&to&limit&cursor` → `CursorPage<NutritionHistoryItemDto>`

`from`/`to` er **påkrævede** `DateTime`. Item = `{ foodLog: FoodLogDto, goalAtConsumption: UserGoalDto | null }`
(målet med `createdAt <= consumedAt`). Cursor = base64url. Ikke nødvendig for UI'et (se §3).

### 1.4 `GET /api/v1/me/history?from&to&types&limit&cursor` → `CursorPage<HistoryEventDto>`

- `HistoryEventDto` = `{ type, occurredAt, referenceId }` – **ingen payload**.
- `type` ∈ `AccountCreated | GoalUpdated | FoodLogged | WeightRecorded | AchievementCompleted`.
- `referenceId` = hhv. `userId` · `userGoalId` · `foodLogId` · `weightLogId` · `userAchievementId`.
- `types` = kommasepareret, case-insensitivt (`FoodLogged,weightrecorded`); ukendt → 400
  `"A history event type is invalid."`. `from`/`to` valgfri.
- Sortering: `occurredAt desc, type desc, id desc`. Slettede madposter udelades.
- Cursor er **standard-base64 med `+ / =`** (`"NjM5MjYz…OjU6MQ=="`), ikke base64url som de
  andre – skal URL-encodes (Angular `HttpParams` gør det korrekt; strengsammensætning gør ikke).
  Ugyldig → 400 `"The history cursor is invalid."`.
- Live efter register: `GoalUpdated` + `AccountCreated` med **samme** `occurredAt`.

### 1.5 `GET /api/v1/me/achievements` → `AchievementDto[]` · `GET /api/v1/me/achievements/{achievementType}` → `AchievementDto`

- Returnerer **altid alle** enum-værdier (også uden række i DB → `progress: 0, completedAt: null`).
- `AchievementDto` = `{ achievementType, name, progress, completionRequirement, completedAt }`.
- `AchievementType`: `FirstMeal` (=1, krav 1), `TenMeals` (=2, krav 10), `TenWeights` (=3, krav 10).
- `name` = `[StringValue]` på **engelsk** (`"First Meal"`) – ikke lokaliseret.
- `progress` = **antal ikke-slettede madposter** (FirstMeal/TenMeals) / **antal vejninger**
  (TenWeights). Den er **ikke** loftet ved kravet (live: FirstMeal `progress: 3`, krav 1).
- `completedAt` sættes én gang og er **klæbrig**: efter sletning af alle madposter var
  FirstMeal `progress: 0` men `completedAt` stadig sat (verificeret).
- Opdateres kun ved `POST/DELETE/restore` af madposter, `POST /meal-collections/{id}/log`
  og `POST/DELETE` af vejninger.
- Ukendt type (`/Nope`, `/99`) → 400 ValidationProblemDetails.

```json
[
  {
    "achievementType": "FirstMeal",
    "name": "First Meal",
    "progress": 3,
    "completionRequirement": 1,
    "completedAt": "2026-09-30T06:27:17.88871Z"
  },
  {
    "achievementType": "TenMeals",
    "name": "Ten Meals",
    "progress": 3,
    "completionRequirement": 10,
    "completedAt": null
  },
  {
    "achievementType": "TenWeights",
    "name": "Ten Weights",
    "progress": 1,
    "completionRequirement": 10,
    "completedAt": null
  }
]
```

### 1.6 Lister, skærmene bygger på (ejes af andre domæner, men bruges her)

| Endpoint                                                                         | Svar                                                                                                                                                                                                                   | Relevant for                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `GET /me/food-logs?from&to&limit&cursor` (alle valgfri)                          | `CursorPage<FoodLogDto>`: `{ foodLogId, foodId, foodName, quantity, unit, caloriesConsumed, proteinConsumed, carbohydratesConsumed, fatConsumed, consumedAt }`                                                         | Historik (mad), gen-log                 |
| `POST /me/food-logs` `{ foodId, quantity, unit, consumedAt }` → 201 `FoodLogDto` | `quantity > 0`, `unit` enum, maden skal være brugerens egen (`createdByUserId == userId`) ellers 404                                                                                                                   | Gen-log                                 |
| `GET /me/weight-logs?from&to&limit&cursor`                                       | `CursorPage<WeightLogDto>`: `{ weightLogId, weight, recordedAt, recordedDate }` (`from/to` filtrerer på `recordedAt`)                                                                                                  | Hjem (dagens vægt, "vej dig"), Historik |
| `GET /me/weight-logs/latest`                                                     | `LatestWeightDto` `{ weightLogId: number \| null, weight, recordedAt, isStartingWeight }`; uden vejninger = profilens startvægt med `recordedAt = konto.createdAt`, `isStartingWeight: true`; 404 hvis ingen startvægt | Målkortet                               |
| `GET /me/goals/current`                                                          | `UserGoalDto` eller **404**                                                                                                                                                                                            | Målkortet, kcal-mål                     |
| `GET /me/goals?from&to&limit&cursor`                                             | `CursorPage<UserGoalDto>`                                                                                                                                                                                              | Historik (`maal`)                       |
| `GET /me/profile`                                                                | `UserProfileDto` inkl. `startingWeight`, `timeZoneId`                                                                                                                                                                  | Målkortet (startvægt)                   |
| `GET /me/meal-collections?limit&cursor`                                          | `CursorPage<MealCollectionDto>`                                                                                                                                                                                        | Præstation "Egen samling"               |

**Bivirkning at kende:** hver vejning, der bliver den seneste, kører
`UserGoalService.RecalculateAsync(userId, force: true)` → **ny `UserGoal`-række (og et
`GoalUpdated`-event) ved hver vejning**, også hvis intet ændrer sig. Når målvægten nås,
skifter API'et selv `goalType` til `MaintainWeight` og `targetWeight` til nuværende vægt.
Verificeret live: én vejning gav `userGoalId` 3 → 4.

---

## 2. Hjem (`HomeSummaryService`)

Anbefaling: brug API'ets **dags-aggregat** (`nutrition/days`) – det matcher UI'et næsten 1:1
og giver oven i købet _målet der gjaldt den dag_, som appen i dag ikke kan. Uge-nøgletal,
streak og ring-andele afledes lokalt af de 7 rækker (ingen API-aggregat findes, og det er
billigt).

| UI                                                         | App i dag (lokal)                                                               | API-kilde                                                                                                | Mapping                                                                                                                                                                                                   | Status                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Ugens 7 ringe                                              | `FoodLogService.dailyTotals(mandag, søndag)` ÷ `AdaptiveGoalService.kcalTarget` | `GET /me/nutrition/days?from=<mandag>&to=<mandag+7>`                                                     | `part = consumed.calories / goal.targetDailyCalories` (pr. dag). Fremtid → `null` som nu. Dag uden poster → `null`                                                                                        | Rent, **men** ingen `entryCount` (gap G5) → workaround: alle fire `consumed`-tal = 0 ⇒ "ingen data"     |
| Dagskort kcal spist / mål                                  | `String(totals.kcal)` / `kcalTarget`                                            | samme række                                                                                              | `Math.round(consumed.calories)` / `Math.round(goal.targetDailyCalories)` (API giver `2105.51`)                                                                                                            | Rent                                                                                                    |
| Dagskort makroer                                           | `NutritionCalculator.macroGoals(kcalTarget)` (30/45/25)                         | `goal.targetProtein/targetCarbohydrates/targetFat`                                                       | `consumed.protein/carbohydrates/fat` → `protein/carbs/fat`                                                                                                                                                | Rent – men API's split er **30/40/30** (gap G7)                                                         |
| Dagskort vægt                                              | `weightLog.entries()` + `isSameDay`                                             | `GET /me/weight-logs?from=<mandag 00:00 lokal→ISO>&to=<næste mandag>`                                    | map på `recordedDate === 'YYYY-MM-DD'`                                                                                                                                                                    | Rent                                                                                                    |
| Ugekort: dage i mål, snit-kcal, protein ramt, streak, note | lokal af `dayParts`                                                             | – (ingen aggregat)                                                                                       | Behold lokal afledning fra de 7 rækker; brug dagens `goal` pr. dag i stedet for ét mål. (Obs: snittet bygger i dag på den **loftede** andel – med API-data kan det tages direkte af `consumed.calories`.) | Lokal afledning                                                                                         |
| "Næste skridt": vej dig                                    | `weightLog.weighedToday()`                                                      | ugens `weight-logs`                                                                                      | `recordedDate === i dag`. **Brug ikke** `latest` alene: på registreringsdagen returnerer den startvægten med dagens `recordedAt` og `isStartingWeight: true`                                              | Rent                                                                                                    |
| "Næste skridt": log morgenmad/frokost/aftensmad/snack      | `foodLog.byMeal()`                                                              | –                                                                                                        | `FoodLogDto` har **ingen måltidstype**                                                                                                                                                                    | **Gap G1** – fallback: én todo "Log dagens første måltid", når dagen har 0 poster                       |
| Målkort                                                    | `profile.goal/goalWeightKg/pace`, ældste vejning som start                      | `GET /me/goals/current` + `GET /me/profile` (`startingWeight`) + `GET /me/weight-logs/latest` (`weight`) | `goalType` `LoseWeight→tabe`, `MaintainWeight→hold`, `GainWeight→tage`; `targetWeight`; `weeks = ceil(left / weightChangePerWeek)`; tempo-etiket: `0.25→rolig`, `0.5→moderat`, `1→hurtig`, ellers default | Rent (404 på `goals/current` = skjul kortet)                                                            |
| `showGoalCard`                                             | `profile.goal !== 'hold'`                                                       | `goal.goalType !== 'MaintainWeight'`                                                                     | –                                                                                                                                                                                                         | Rent, men API skifter selv til `MaintainWeight` ved nået mål → "Mål nået"-teksten ses reelt aldrig (G8) |
| Fejrings-toast (`goalReached`)                             | dagens andel ≥ 1                                                                | dagens række                                                                                             | `consumed.calories >= goal.targetDailyCalories`                                                                                                                                                           | Rent – kræver genhentning efter hver madlog-ændring                                                     |
| Hilsen/navn/avatar                                         | profil                                                                          | `GET /me` (`username`), profilbillede                                                                    | –                                                                                                                                                                                                         | Profil-domænet                                                                                          |

Kald pr. Hjem-visning: `nutrition/days` (uge), `weight-logs` (uge), `goals/current`,
`profile`, `weight-logs/latest`. De sidste tre deles med profil/vægt-domænet og bør caches
dér. Et samlet `dashboard`-endpoint ville spare kald, men er ikke nødvendigt (G11).

---

## 3. Historik (`HistoryService`)

Anbefaling: **brug ikke `GET /me/history` til at tegne listen.** Eventet har kun
`type/occurredAt/referenceId`, så hver række kræver et opslag mere (N+1). Hent i stedet de tre
lister for samme tidsvindue (1 kald hver, cursor-loop ved > 100) og flet lokalt – det er præcis
det, `buildEntries()` gør i dag.

| Posttype                           | App i dag                               | API                                                                            | Mapping                                                                                                                                                                                                                                                                              | Status                                                                      |
| ---------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Vejning (`vejning`)                | `weightLog.entries()`                   | `GET /me/weight-logs?from&to&limit=100`                                        | `id: 'vejning-' + weightLogId`, `kg: weight`, `date: new Date(recordedAt)`; nyeste får "Seneste vejning"                                                                                                                                                                             | Rent                                                                        |
| Mad (`mad`)                        | `foodLog.allEntries()` (90 dage lokalt) | `GET /me/food-logs?from&to&limit=100` + cursor-loop                            | `title: foodName`, `value: round(caloriesConsumed)`, `date: new Date(consumedAt)`                                                                                                                                                                                                    | Rent, **undertekst = måltid mangler** (G1) → fallback `"{quantity} {unit}"` |
| Mål (`maal`)                       | altid tomt                              | `GET /me/goals?from&to`                                                        | Ny: titel "Mål opdateret", værdi `round(targetDailyCalories) kcal`, undertekst = måltype. **Dedup**: vis kun en række, når `(goalType, targetWeight, weightChangePerWeek)` ændrer sig ift. forrige mål – ellers bliver filteret fyldt af automatiske genberegninger ved hver vejning | Muligt nu; støj = gap G6                                                    |
| Dagsopsummering (`foodSummary`)    | `foodLog.totalsFor(dag)`                | summér de hentede `FoodLogDto` pr. lokal dag (alle poster i vinduet er hentet) | `caloriesConsumed/proteinConsumed/carbohydratesConsumed/fatConsumed`                                                                                                                                                                                                                 | Rent. Alternativ: `nutrition/days` (max 32 dage/kald)                       |
| Gen-log                            | `foodLog.add(food, meal)`               | `POST /me/food-logs { foodId, quantity, unit, consumedAt: now }`               | tag `foodId/quantity/unit` fra den oprindelige `FoodLogDto`; genindlæs listen bagefter                                                                                                                                                                                               | Rent (måltid kan ikke bevares – G1)                                         |
| Konto oprettet / præstation klaret | findes ikke i designet                  | `GET /me/history?types=AccountCreated,AchievementCompleted`                    | Kun hvis design ønsker det. `AchievementCompleted.referenceId` = `userAchievementId`, som **ikke** findes i `AchievementDto` → kan kun matches på `occurredAt === achievement.completedAt`                                                                                           | Gap G4                                                                      |

Vindue: behold dagens 90 dage (`from = i dag − 89 dage 00:00 lokal`, `to = i morgen 00:00`)
så UX'et er uændret. 90 dage × ~5 madposter ≈ 5 kald à 100 – acceptabelt. (En "Vis ældre"-knap
kan komme senere; den kræver design + i18n.)

---

## 4. Præstationer (`AchievementsService`)

Designet har 12 badges, API'et har 3 typer. Kun **én** matcher direkte. Resten afledes lokalt
af API-hentede data (som opgaven foreskriver), hvor det kan lade sig gøre.

| App-badge (`id`)               | App i dag                                   | API-dækning                    | Afledning efter API                                                                                                                                                   | Status                    |
| ------------------------------ | ------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `meals-10` "10 måltider"       | `foodLog.entries().length` (kun i dag!)     | **`TenMeals`**                 | `value = min(progress, 10)`, `complete = completedAt !== null` (klæbrig)                                                                                              | **Direkte map**           |
| `meals-50` "50 måltider"       | samme                                       | –                              | `TenMeals.progress` er det ulåste antal madposter → `progress >= 50` (virker, men lener sig op ad en implementeringsdetalje)                                          | Afledt · G3               |
| `first-weigh` "Første vejning" | `entries().length > 0`                      | ~ (`TenWeights` er 10, ikke 1) | `TenWeights.progress >= 1`                                                                                                                                            | Afledt · G3               |
| `streak-7` / `streak-30`       | kun i dag (0/1)                             | –                              | fra `GET /me/nutrition/days?from=<i dag−31>&to=<i morgen>` (32 dage = max): antal sammenhængende dage bagud med `consumed.calories ≥ 0.95 × goal.targetDailyCalories` | Afledt (max 32 dage) · G3 |
| `protein-5`                    | kun i dag                                   | –                              | samme 32-dages rækker: dage i indeværende uge med `consumed.protein ≥ 0.95 × goal.targetProtein`                                                                      | Afledt · G3               |
| `perfect-week`                 | kun i dag                                   | –                              | ugens 7 rækker alle ramt                                                                                                                                              | Afledt · G3               |
| `lost-2` / `lost-5`            | ældste vejning − profilvægt                 | –                              | `profile.startingWeight − latest.weight` (bedre start end "ældste vejning")                                                                                           | Afledt · G3               |
| `own-collection`               | `collections.userCollections()`             | –                              | `GET /me/meal-collections?limit=1` → `items.length > 0` (eller samlings-domænets service)                                                                             | Afledt · G3               |
| `scans-10`                     | `scanner.scanCount()` (lokal tæller)        | –                              | Ingen scan-data i API'et → forbliver enheds-lokal                                                                                                                     | **Gap G9**                |
| `no-late-snack`                | pladsholder = `hitDays` (ikke rigtig logik) | –                              | Kræver en definition (fx ingen `consumedAt` efter 21:00 lokal i 7 dage) – kan afledes af `food-logs`, men produktet skal definere den                                 | Gap G3 (definition)       |
| –                              | –                                           | **`FirstMeal`**                | Intet badge i designet → ignorér (eller erstat et badge)                                                                                                              | Produktbeslutning         |

Regler i mapningen:

- Brug `achievementType` → i18n-nøgle (`profile.achievements.*`); brug **ikke** `name` (engelsk).
- `complete = completedAt !== null`, ikke `progress >= completionRequirement` (sletning
  sænker progress, men ikke `completedAt`).
- Klip `progress` til `[0, completionRequirement]` før ringen tegnes.
- Ignorér ukendte `achievementType`-værdier (API'et kan få flere).
- Lokalt afledte badges er "live" og kan miste status igen (fx streak) – kun API-typerne er
  klæbrige.

---

## 5. `AdaptiveGoalService` (kcal-målet på Hjem, Mad og Profil)

- **Input kan hentes:** 21 afsluttede dage = `GET /me/nutrition/days?from=<i dag−21>&to=<i dag>`
  (→ `DailyFoodTotals`; `entryCount` mangler, men algoritmens `ADAPTIVE_MIN_DAY_FRACTION`
  (≥ 50 % af formel-TDEE) sorterer nul-dage fra alligevel) + `GET /me/weight-logs?from&to`.
- **Konflikten:** API'et beregner selv `targetDailyCalories` (`GoalCalculator`: anden
  aktivitetsformel, min. 1500/1200 kcal, 2 decimaler, split 30/40/30) og genberegner ved hver
  vejning. Appen har sin egen formel (PAL-tabel + MET, afrundet til 10, min. 1200), adaptiv
  justering (±300) og manuel `kcalOverride`. API'et har **hverken override eller adaptiv
  justering** (G7).
- **Anbefaling (mindst mulig ny kode, én sandhed):** kcal-mål og makromål = API'ets mål
  (`goals/current` / dagens `goal`), rundet til heltal. `AdaptiveGoalService.kcalTarget` bliver
  `round(goal.targetDailyCalories)`; formel/adaptiv/override-logikken står stille, til API'et
  understøtter det. Ellers viser appen andre tal end API'ets `remaining` og andre enheder.
  **Dette er en produktbeslutning for Janick** – den rører også Profil og Mad.

---

## 6. Implementeringsplan (minimal, følger ARCHITECTURE.md)

Forudsætninger fra andre domæner: `API_BASE_URL`-token, auth-interceptor (bearer + refresh),
dev-proxy til `ng serve` / `CapacitorHttp` på native, API-baserede `FoodLogService` og
`WeightLogService` i `core/`. Denne plan genbruger dem og opfinder dem ikke igen.

1. **DTO-typer** i `core/models/api/` (eller hvor de andre domæner lægger dem):
   `NutritionTotalsDto`, `NutritionDayDto`, `UserGoalDto`, `WeightLogDto`, `LatestWeightDto`,
   `FoodLogDto`, `CursorPage<T>`, `AchievementDto`,
   `type AchievementType = 'FirstMeal' | 'TenMeals' | 'TenWeights'`,
   `type GoalType = 'LoseWeight' | 'MaintainWeight' | 'GainWeight'`. Ingen `any`.
2. **`core/services/nutrition-days/`** (`providedIn: 'root'`): ét `httpResource<NutritionDayDto[]>`
   for `from = i dag − 31`, `to = i morgen` (32 dage – max). Det ene kald dækker Hjems uge
   (mandag…i dag ligger altid inden for de 31 dage), streaks/protein/perfekt uge og
   adaptiv-vinduet. Nøgle = `FoodLogService.today()` + en `version`-signal fra
   `FoodLogService`, der tælles op efter hver POST/PATCH/DELETE, så Hjem og toasten
   opdateres. Mapper `consumed` → `Macros` (`calories→kcal`, `carbohydrates→carbs`,
   `Math.round`) og markerer nul-dage som `null`. (Uden en fremtidig dag i vinduet
   giver fremtidige ugedage `null`, præcis som i dag.)
3. **`core/services/achievements-api/`**: `httpResource<AchievementDto[]>` på `GET /me/achievements`,
   genindlæses på samme `version`-signaler (madlog + vægt).
4. **`HomeSummaryService`**: skift `dayTotals` til rækkerne fra (2) for mandag…søndag; mål pr.
   dag = `day.goal?.targetDailyCalories ?? currentGoal`; makromål fra `day.goal`; vægt pr. dag
   fra `WeightLogService` (API) på `recordedDate`; målkort fra `goals/current` + `profile.startingWeight`
   - `latest.weight`; måltids-todos → én "log første måltid"-todo indtil G1 er løst. Udstil
     `isLoading`/`error` fra ressourcerne.
5. **`HistoryService`**: kilde = `food-logs` + `weight-logs` + `goals` for 90-dages-vinduet
   (lille `fetchAllPages<T>()`-hjælper med `expand` til `hasMore === false`, i `core/utils`
   eller i API-servicen); mapning DTO → `HistoryEntry` i servicen; `maal`-poster med dedup;
   `foodSummary` = lokal sum af de hentede poster; gen-log via `FoodLogService` (POST) + reload.
6. **`AchievementsService`**: `meals-10` fra `TenMeals`; resten som i tabellen i §4 fra (2),
   (3), vægt/profil og samlinger. `scans-10` bliver lokal. `FirstMeal` ignoreres.
7. **`AdaptiveGoalService`**: jf. §5 (afventer beslutning).
8. **UI-tilstande** (krav i ARCHITECTURE §8): `HomePage` og `HistoryPage` får loading
   (`app-ui-spinner`), fejl (`app-ui-form-error` + "Prøv igen" → `resource.reload()`) og tom
   tilstand (`app-ui-empty-state`). Nye tekster som nøgler i `src/i18n/da.json` + `en.json`.
   README'erne i `features/home`, `features/history`, `features/profile/services` og
   `core/services/*` opdateres (de siger i dag "ingen netværkskald").
9. **Tests**:
   - Service-specs med `provideHttpClient()` + `provideHttpClientTesting()` og
     `HttpTestingController`; fixtures = de rigtige JSON-svar i §1 (decimaler, `Z`-tider,
     `goal: null`-dage, nul-dage, klæbrig `completedAt` med `progress: 0`).
   - Specifikke cases: dag uden poster → `null`-ring; dag før første mål (`goal: null`);
     registreringsdag (`latest.isStartingWeight: true` må ikke give "vejet i dag");
     tidszone-grænse (22:30Z = næste lokale dag); cursor-loop over 2 sider; 400/401/404/
     netværksfejl → fejltilstand; dedup af `goals`.
   - UI-test i browser-panelet mod dev-containeren (`localhost:5210`) via dev-proxy med en
     test-konto (register → token fra `docs/api-integration/docker/outbox` → verify → login).

---

## 7. Bulletpoints til API-teamet (gaps)

- **G1 – Måltidstype på madposter (blocker, deles med Mad-domænet).** `FoodLog`/`FoodLogDto`/
  `CreateFoodLogRequest`/`UpdateFoodLogRequest` har intet måltid. Appen grupperer alt efter
  morgenmad/frokost/aftensmad/snack (Hjems "Næste skridt", Historikkens undertekst, gen-log til
  samme måltid, Mad-skærmen). Forslag: `enum MealType { Breakfast = 1, Lunch = 2, Dinner = 3, Snack = 4 }`
  som påkrævet felt `mealType` på create/update/DTO (og på `POST /me/meal-collections/{id}/log`).
- **G2 – CORS (major, tværgående).** `Program.cs` har ingen `AddCors`/`UseCors`; preflight
  giver 405. Forslag: CORS-policy for `http://localhost:4200`, `capacitor://localhost`,
  `http://localhost` (Android) med `Authorization`/`Content-Type`-headers.
- **G3 – Præstationer matcher ikke designet (major).** API: `FirstMeal`(1), `TenMeals`(10),
  `TenWeights`(10). Designet: 7-dages streak, første vejning, 10 måltider, 2 kg tabt,
  protein-mål 5×, egen samling, 30-dages streak, 50 måltider, 5 kg tabt, 10 scanninger,
  ingen sen snack, perfekt uge. Kun `TenMeals` matcher. Forslag: nye `AchievementType`-værdier
  med `[CompletionRequirement]`: `FirstWeight`(1), `FiftyMeals`(50), `CalorieStreak7`(7),
  `CalorieStreak30`(30), `ProteinGoal5`(5), `Lost2Kg`(2), `Lost5Kg`(5), `OwnCollection`(1),
  `PerfectWeek`(7), `Scans10`(10, kræver G9) og `NoLateSnack`(7, kræver en fælles
  definition). Streaks/procent-ramt bør bruge samme regel som appen: dag ramt ved ≥ 95 % af
  dagens `targetDailyCalories`/`targetProtein`.
- **G4 – Historik-events kan ikke vises uden ekstra kald (major).** `HistoryEventDto` er kun
  `{ type, occurredAt, referenceId }`. `AchievementCompleted.referenceId` er
  `userAchievementId`, som ikke findes i `AchievementDto` → kan ikke kobles til en type.
  Forslag: tilføj en payload pr. type (fx `weight`; `foodName`, `calories`, `foodId`,
  `quantity`, `unit`; `goalType`, `targetDailyCalories`; `achievementType`), eller mindst
  `achievementType` på eventet og `userAchievementId` på `AchievementDto`.
- **G5 – `NutritionDayDto` mangler antal poster (minor).** En dag uden poster og en dag med
  0 kcal ser ens ud (`consumed` = nuller). Forslag: `int EntryCount` på `NutritionDayDto`.
- **G6 – Mål-historik fyldes af automatiske genberegninger (major).**
  `WeightLogService` kalder `RecalculateAsync(userId, force: true)` ved hver vejning, der
  bliver den seneste → ny `UserGoal`-række og `GoalUpdated`-event hver gang, også når intet
  ændrer sig (`force` springer lighedstjekket over). Brugerens egne målændringer kan ikke
  skelnes fra automatiske. Forslag: spring indsættelsen over, når værdierne er uændrede, og
  tilføj `Source`/`Reason` (`User | WeightRecalculation | TargetReached`) på `UserGoal`/`UserGoalDto`
  (og/eller event-typen `GoalRecalculated`).
- **G7 – Kaloriemål: ingen manuel override, ingen adaptiv justering, andet makro-split (major,
  deles med Mål/Profil).** Appen lader brugeren sætte et manuelt kcal-mål og justerer målet
  adaptivt (±300 kcal ud fra 21 dages indtag + vægttrend); makro-split 30/45/25.
  API'et: kun `GoalCalculator` (30/40/30, 2 decimaler, min. 1500/1200). Forslag: valgfri
  `targetDailyCaloriesOverride` på `CreateUserGoalRequest` (eller `SettingKey.CalorieTarget`),
  og en afklaring af split og formel, så app og API viser samme tal.
- **G8 – Intet signal for "målvægt nået" (minor).** `RecalculateAsync` skifter stille til
  `MaintainWeight` og sætter `targetWeight` = nuværende vægt. Appen kan ikke vise "Mål nået"
  eller fejre det. Forslag: `ReachedAt`/`Reason = TargetReached` på det nye mål eller et
  `GoalReached`-historik-event.
- **G9 – Ingen scanninger i API'et (minor).** Badget "10 scanninger" kræver en tæller.
  Forslag: `Scans10`-achievement med et endpoint til at registrere en scanning (fx
  `POST /me/achievements/scans`) eller tælle `Food.Barcode`-oprettelser.
- **G10 – Uens cursor-format (minor).** `/me/history` bruger standard-base64 med `+ / =`;
  alle andre bruger base64url uden padding (`CursorCodec`). Forslag: brug `CursorCodec` også
  i `HistoryService`.
- **G11 – Intet Hjem-aggregat (minor, nice-to-have).** `DashboardController` er en tom stub.
  Hjem kræver 5 kald. Forslag (valgfrit): `GET /me/dashboard?weekStart=YYYY-MM-DD` med ugens
  `NutritionDayDto[]`, ugens vejninger, `goals/current`, `weight-logs/latest` og
  `profile.startingWeight`.
- **G12 – Præstationsnavne er kun engelske (minor).** `AchievementDto.name` kommer fra
  `[StringValue]` ("First Meal"). Appen oversætter selv ud fra `achievementType`, så feltet
  bliver ikke brugt. Ikke kritisk, men værd at vide.
