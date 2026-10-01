# Vægt (vejninger): mapning mellem app og API

> **Baggrund fra før integrationen.** Beslutningerne står i `../plan-v2.md`, som går forud for denne fil; status i `../README.md`.

Kilder, læst direkte i koden:

- API: `API/Controllers/WeightLogsController.cs`, `API/DTOs/Weights/*.cs`,
  `API/Services/Weights/WeightLogService.cs`, `API/Domain/Entities/WeightLog.cs`,
  `API/Data/FitnessAppDbContext.cs` (`ConfigureWeightLog`),
  `API/Exceptions/WeightDateConflictException.cs`, `API/Exceptions/GlobalExceptionHandler.cs`,
  `API/Utilities/RequestGuards.cs`, `API/Utilities/CursorCodec.cs`, `API/DTOs/Common/CursorPage.cs`,
  `API/Services/Goals/UserGoalService.cs` (`RecalculateAsync`, `GetCurrentWeightAsync`),
  `API/Services/Achievements/AchievementService.cs`, `API/Services/Profiles/UserProfileService.cs`,
  `API/Services/Auth/AuthService.cs`, `API/Program.cs`. `API/Controllers/WeightController.cs` er en
  tom klasse uden ruter og kan ignoreres.
- Bekræftet mod den kørende dev-container (`fitnessapp-dev-api-1`, `http://localhost:5210`):
  `GET /health` giver 200, `GET /api/v1/me/weight-logs` uden token giver `401` med tom body og
  `WWW-Authenticate: Bearer`, og `/swagger/v1/swagger.json` bekræfter camelCase-feltnavnene.
- App: `src/app/core/services/weight-log/weight-log.ts`, `core/models/weight.ts`,
  `core/constants/weight.ts`, `features/weight/**`. Øvrige forbrugere af `WeightLogService` er
  `core/services/adaptive-goal`, `features/home/services/home-summary.ts`,
  `features/profile/services/achievements.ts` og `features/history/services/history.ts`.

---

## 1. API-kontrakten

### Serialisering (Program.cs)

- `AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))`.
  Der er ingen egen `PropertyNamingPolicy`, så ASP.NET's web-default gælder: **camelCase**.
  Enums serialiseres som navnestrenge, men vægt-domænet har ingen enums.
- `decimal` bliver et JSON-tal: `72.40` kommer ud som `72.40`, og JS læser det som `72.4`.
  Swagger kalder det `format: double`.
- `DateTime` med Kind=Utc bliver ISO 8601 med `Z`, f.eks. `"2026-09-30T05:45:00.123456Z"`.
  Npgsql læser `timestamp with time zone` som Utc.
- `DateOnly` bliver `"yyyy-MM-dd"`.
- **Ind-parsing af DateTime:** `RequestGuards.NormalizeUtc` behandler `DateTimeKind.Unspecified`
  som **UTC**. En tid uden offset, f.eks. `"2026-09-30T07:45:00"`, bliver derfor gemt som
  07:45Z. Appen skal altid sende `Date.prototype.toISOString()` (med `Z`).
- CORS er ikke konfigureret: der er hverken `AddCors` eller `UseCors` (se gaps).

### Endpoints: `[ApiController] [Authorize] [Route("api/v1/me/weight-logs")]`

Alle kræver et Bearer access-JWT (`token_type=access`, brugeren skal være aktiv, have verificeret
e-mail og ikke være slettet). Ellers kommer `401` med tom body.

| Verb     | Rute                              | Input                                                                           | Succes                                            | Fejl                                                                                                                                          |
| -------- | --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/me/weight-logs`          | query `from?: DateTime`, `to?: DateTime`, `limit: int = 50`, `cursor?: string`  | `200 CursorPage<WeightLogDto>`                    | `400` "The cursor is invalid." · `400` hvis `from >= to`                                                                                      |
| `GET`    | `/api/v1/me/weight-logs/latest`   | –                                                                               | `200 LatestWeightDto`                             | `404` hvis der hverken er vejninger eller profil (eller `startingWeight <= 0`)                                                                |
| `GET`    | `/api/v1/me/weight-logs/{id:int}` | –                                                                               | `200 WeightLogDto`                                | `404` "Weight log not found." (også når vejningen tilhører en anden bruger)                                                                   |
| `POST`   | `/api/v1/me/weight-logs`          | body `CreateWeightLogRequest`                                                   | **`201`** `WeightLogDto`, ingen `Location`-header | `400` vægt uden for 25–400 · `400` "Complete a profile with a time zone before recording weight." · **`409`** samme kalenderdag (se nedenfor) |
| `PATCH`  | `/api/v1/me/weight-logs/{id:int}` | body `UpdateWeightLogRequest` (felter der er udeladt eller `null`, ændres ikke) | `200 WeightLogDto`                                | `400` vægt · `404` · `409` hvis `recordedAt` flyttes til en dag, der allerede har en vejning                                                  |
| `DELETE` | `/api/v1/me/weight-logs/{id:int}` | –                                                                               | `204` uden body                                   | `404`                                                                                                                                         |

Swagger siger `200` for POST og DELETE og dokumenterer hverken 201, 204, 400, 404 eller 409.
Kontrakten ovenfor er læst i controllerkoden.

### DTO'er (JSON-form)

```ts
// WeightLogDto(int WeightLogId, decimal Weight, DateTime RecordedAt, DateOnly RecordedDate)
interface WeightLogDto {
  weightLogId: number; // int, > 0
  weight: number; // kg, numeric(5,2)
  recordedAt: string; // ISO UTC med 'Z'
  recordedDate: string; // 'yyyy-MM-dd' – dagen i brugerens profil-tidszone (server-beregnet)
}

// CursorPage<T>(IReadOnlyList<T> Items, string? NextCursor, bool HasMore)
interface CursorPage<T> {
  items: T[];
  nextCursor: string | null; // null når hasMore = false
  hasMore: boolean;
}

// LatestWeightDto(int? WeightLogId, decimal Weight, DateTime RecordedAt, bool IsStartingWeight)
interface LatestWeightDto {
  weightLogId: number | null; // null når isStartingWeight = true
  weight: number;
  recordedAt: string; // ved startvægt: brugerens User.CreatedAt
  isStartingWeight: boolean;
}

// CreateWeightLogRequest(decimal Weight, DateTime RecordedAt): begge er ikke-nullable værdityper
interface CreateWeightLogRequest {
  weight: number;
  recordedAt: string;
}

// UpdateWeightLogRequest(decimal? Weight, DateTime? RecordedAt)
interface UpdateWeightLogRequest {
  weight?: number | null;
  recordedAt?: string | null;
}
```

### Fejl-body

`GlobalExceptionHandler` skriver `ProblemDetails` med `WriteAsJsonAsync`. Content-type er
`application/json`, og `type`/`instance` udelades, fordi de er null:

```json
{ "title": "Validation failed", "status": 400, "detail": "Weight must be between 25 and 400 kg." }
```

Ved en konflikt på samme dag (`WeightDateConflictException`) kommer `existingWeightLogId` med som
en extension på topniveau:

```json
{
  "title": "Conflict",
  "status": 409,
  "detail": "A weight entry already exists for this calendar day.",
  "existingWeightLogId": 42
}
```

Model-binding-fejl, f.eks. `"weight": "abc"` eller ugyldig JSON, giver en standard
`ValidationProblemDetails` med status `400` og et `errors`-objekt. `detail`-teksterne er engelsk
fritekst uden en maskinlæsbar kode.

### Regler og adfærd (WeightLogService)

- **Vægt:** `25 <= weight <= 400` (kg, begge grænser inklusive). Ellers kommer `400`. DB-kolonnen er
  `numeric(5,2)`. Appens egne grænser er strammere (`WEIGHT_MIN_KG = 30`,
  `WEIGHT_MAX_KG = 300`), så appen rammer aldrig API'ets 400.
- **Enhed:** altid kg. Der er intet enhedsfelt på vejningen. User-settingen `WeightUnit` (`"kg"` eller
  `"lb"`) er kun en præference.
- **Ingen note/kommentar-felt.** Appen har heller ikke et.
- **Én vejning pr. dag:** `recordedDate` bliver beregnet af serveren som
  `DateOnly(ConvertTimeFromUtc(recordedAt, profile.TimeZoneId))`. Der er et unikt indeks på
  `(UserId, RecordedDate)`. POST på en dag, der allerede har en vejning, giver `409` med
  `existingWeightLogId`. Serveren **erstatter ikke** den eksisterende vejning.
- **Kræver en profil med `TimeZoneId`.** Registrering (`RegisterRequest.TimeZoneId`, required,
  maks. 100 tegn) opretter altid profilen, så en registreret bruger kan logge med det samme.
  `TimeZoneId` bliver valideret med `TimeZoneInfo.FindSystemTimeZoneById`, og IANA-id'er som
  `"Europe/Copenhagen"` virker.
- **Liste:** sorteret efter `recordedAt desc`, derefter `weightLogId desc`. `from` er inklusiv og
  `to` eksklusiv, og begge gælder `recordedAt` (tidsstemplet), ikke `recordedDate`. `limit <= 0`
  bliver til 50, og `limit > 100` bliver lydløst til 100. `cursor` er en uigennemsigtig base64url-streng
  (`ticks:id`), som sendes videre uændret fra `nextCursor`.
- **Aktuel vægt i API'et** er den nyeste vejning, ellers `profile.StartingWeight`
  (`UserGoalService.GetCurrentWeightAsync`, `GET /latest`). Profilen har **intet** felt for
  aktuel vægt: `UserProfileDto` har kun `startingWeight`. Registreringen opretter ingen vejning,
  kun `StartingWeight`.
- **Sideeffekter (i samme transaktion):**
  - Create og Delete kalder `AchievementService.UpdateWeightProgressAsync`, som tæller
    vejninger til `TenWeights`.
  - Når Create, Update eller Delete påvirker den **nyeste** vejning, og brugeren har et mål, bliver
    `UserGoalService.RecalculateAsync(userId, force: true)` kaldt. Det giver **en ny `UserGoal`-række
    ved hver vejning** (nyt kalorie- og makromål) og dermed også en `GoalUpdated`-hændelse i
    historikken. Hvis et Lose- eller Gain-mål er nået (`current <= target` henholdsvis
    `current >= target`), **skifter serveren selv målet til `MaintainWeight`** med
    `targetWeight = currentWeight`. Intet af det kan ses i vægt-svaret.
- **Delete af den sidste vejning:** API'ets aktuelle vægt falder tilbage til `startingWeight`, altså
  registreringsvægten. Målet bliver genberegnet ud fra den.

---

## 2. Mapning mellem app og API

### Model

App: `WeighEntry { id: string; kg: number; at: string }`. UI-modellen bevares, og mapningen sker i
`WeightLogService`.

| App (`WeighEntry`)                  | API (`WeightLogDto`)  | Mapning                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id: string` (i dag `weigh-<uuid>`) | `weightLogId: number` | `id: String(dto.weightLogId)`. Typen `string` bevares, så `WeighLogRow.id`, redigeringsarket, `track` i listen og History (`vejning-${id}`) ikke skal ændres. URL'en bygges direkte: `me/weight-logs/${id}`.                                                                                                                    |
| `kg: number`                        | `weight: number`      | Direkte. Appen runder fortsat til 0,1 kg (`roundTo(kg, 1)`), før den sender.                                                                                                                                                                                                                                                    |
| `at: string` (ISO)                  | `recordedAt: string`  | Direkte. Send altid `toISOString()`.                                                                                                                                                                                                                                                                                            |
| –                                   | `recordedDate`        | Bruges ikke i UI'et. `weighedToday` og `isSameDay` fortsætter med enhedens lokale dag ud fra `at`, mens serveren bruger profilens `TimeZoneId`. De to er ens, når registreringen sender `Intl.DateTimeFormat().resolvedOptions().timeZone` (auth-domænet). En afvigelse, f.eks. på rejse, håndteres af 409-fallbacken nedenfor. |

### Operationer

| App (`WeightLogService`)                                             | I dag (lokalt)                                            | Med API                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `restore()` ved opstart                                              | `localStorage['nutrify.weight-log']`                      | `load()`: `GET me/weight-logs?limit=100`, **én request** (se begrundelse nedenfor). `items` mappes og sættes i `entriesState`. Rækkefølgen er allerede nyeste først.                                                                                                                                                                                                   |
| `add(kg, at = now)`: erstatter dagens vejning                        | Finder vejningen fra samme dag lokalt og beholder dens id | `POST me/weight-logs {weight, recordedAt: at.toISOString()}` giver `201`. **Ved `409`** kaldes `PATCH me/weight-logs/{error.existingWeightLogId} {weight, recordedAt}`, som giver `200`. Dermed er det serveren, der afgør hvilken dag vejningen hører til, og reglen "vej igen = erstat dagens" bevares. Resultatet upsert'es ud fra id.                              |
| `update(id, kg)`                                                     | Kun ny vægt, tiden er uændret                             | `PATCH me/weight-logs/{id} {weight}`. `recordedAt` udelades, så den ikke ændres. `200` erstatter vejningen ud fra id.                                                                                                                                                                                                                                                  |
| `remove(id)`                                                         | Filtrerer vejningen fra                                   | `DELETE me/weight-logs/{id}`. `204` filtrerer vejningen fra.                                                                                                                                                                                                                                                                                                           |
| `latest`, `weighedToday`, `entriesWithin`, `seriesFor`, `rangeLabel` | `computed` over `entries`                                 | **Uændret**, fordi de filtreres på klienten over den indlæste side.                                                                                                                                                                                                                                                                                                    |
| Synkronisering af profilvægten (`commit`)                            | `profile.update({ weightKg: latest.kg })`                 | Samme kald, men kun lokalt i hukommelsen, fordi API'et ikke har et felt for aktuel vægt. **Adfærdsændring:** bliver listen tom (den eneste vejning er slettet), sættes `weightKg` fra `GET me/weight-logs/latest` (`isStartingWeight: true`, dvs. startvægten). Hidtil blev den slettede vægt stående. Det holder appen på linje med serverens mål- og kcal-beregning. |
| –                                                                    | –                                                         | Efter hver vellykket create, update eller delete skal målet genhentes med `GET /api/v1/me/goals/current`, fordi serveren kan have genberegnet det eller skiftet det til `MaintainWeight`. Det ligger i mål-domænet. `WeightLogService` kalder bare mål-servicens `refresh()`.                                                                                          |

### Hvorfor `limit=100` og ingen paginering i vægt-skærmen

Serveren håndhæver højst én vejning pr. dag (unikt indeks), så de 100 nyeste vejninger dækker
mindst 100 dage. Det rækker til alt, hvad der læser vægtdata:

- grafens og listens længste interval (`'3m'` = 90 dage),
- `AdaptiveGoalService` (`ADAPTIVE_WINDOW_DAYS = 21`),
- Hjems ugedage (`weightForDay`),
- `allLogRows`' "forrige vejning" til deltaet på den ældste viste række. Række nr. 100 er mindst 99
  dage gammel og vises derfor aldrig i 3-måneders-listen, så "Start"-mærket bliver aldrig sat forkert.

`nextCursor` og `hasMore` ignoreres i vægt-skærmen (YAGNI). Tre forbrugere bruger i dag den
**ældste** vejning (`entries().at(-1)`) og bør i stedet bruge `UserProfileDto.startingWeight`
(profil-domænet):

- `home-summary.ts` `goalSummary.startKg`,
- `achievements.ts` `kgLost`,
- History-listen, som viser _alle_ vejninger. Se afsnittet om tværgående afhængigheder.

### Fejlmapning (UI)

Den tekniske `detail` vises aldrig til brugeren (ARCHITECTURE §11).

| HTTP                          | Hvor           | Appens reaktion                                                                                     |
| ----------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `409` + `existingWeightLogId` | POST i `add()` | Håndteres internt med PATCH af den eksisterende vejning. Brugeren ser ingen fejl.                   |
| `404`                         | PATCH/DELETE   | Vejningen er væk (slettet fra en anden enhed): kald `load()` igen og vis en generel fejltekst.      |
| `400`                         | POST/PATCH     | Generel fejltekst ("Vejningen kunne ikke gemmes"). Appens egne grænser gør, at den sjældent opstår. |
| `401`                         | alle           | Håndteres af auth-interceptoren (refresh eller log ud), ikke her.                                   |
| `0` / `5xx`                   | alle           | Generel netværksfejl. Kladdevægten beholdes, og redigeringsarket forbliver åbent.                   |

---

## 3. Implementeringsplan (minimal, følger ARCHITECTURE.md)

**Forudsætninger fra andre domæner** (auth og infrastruktur, ikke vægt):

- et `API_BASE_URL`-token (dev: `http://localhost:5210/api/v1/`),
- en Bearer-interceptor med 401-håndtering,
- at registreringen sender `timeZoneId`,
- en CORS-omvej: `proxy.conf.json` til `ng serve` og `CapacitorHttp` (`plugins.CapacitorHttp.enabled`)
  på native, da API'et ikke har CORS. Android mod `http://10.0.2.2:5210` kræver desuden
  cleartext i dev.

1. **`core/models/weight.ts`**: tilføj `WeightLogDto`, `CreateWeightLogRequest`,
   `UpdateWeightLogRequest`, `LatestWeightDto` og `WeightDateConflictProblem`
   (`{ status: 409; existingWeightLogId: number }`). `WeighEntry` og `WeightPoint` er uændrede.
   Læg `CursorPage<T>` i `core/models/api.ts`, fordi food logs, mål og historik bruger samme form.
2. **`core/constants/weight.ts`**: `WEIGHT_LOG_ENDPOINT = { LIST: 'me/weight-logs', LATEST: 'me/weight-logs/latest' } as const`
   og `WEIGHT_LOG_PAGE_LIMIT = 100` (API'ets maksimum).
3. **`core/services/weight-log/weight-log.ts`**: erstat `StorageService` med `HttpClient`.
   - Signalerne `entries`, `latest` og `weighedToday` bevares uændret. Tilføj
     `status: Signal<'idle' | 'loading' | 'ready' | 'error'>`.
   - `load(): Observable<void>` laver GET-kaldet med `limit` og mapper med
     `toEntry(dto): WeighEntry`.
   - `add(kg, at = now()): Observable<WeighEntry>`:
     `post(...).pipe(catchError(e => isWeightConflict(e) ? patch(e.error.existingWeightLogId, body) : throwError(() => e)), map(toEntry), tap(upsert))`.
   - `update(id, kg)` bruger `patch(id, { weight })`, og `remove(id)` bruger `delete(id)`. Begge
     returnerer `Observable`.
   - `upsert` erstatter ud fra id eller indsætter og sorterer derefter nyeste først med
     `Date.parse(b.at) - Date.parse(a.at)`. Serverens ISO-strenge har et varierende antal
     brøkcifre, så `localeCompare` er ikke pålidelig.
   - `commit` bevarer `profile.update({ weightKg })`. Er listen tom, hentes `LATEST`, og
     `weightKg` sættes fra `weight`.
   - Efter en vellykket mutation kaldes mål-servicens `refresh()` (se tværgående afhængigheder).
   - `STORAGE_KEY.WEIGHT_LOG` fjernes og kaldes én gang med `storage.remove`. Lokale data migreres
     ikke (før release, YAGNI).
4. **Hvem kalder `load()`**: session-bootstrap efter login eller ved app-start med en gyldig session
   (auth-domænet), samt "Prøv igen" på vægt-skærmen.
5. **`features/weight/services/weight-view.ts`**:
   - `save()`, `saveEdit(kg)` og `removeEditing()` returnerer `Observable<…>`. `editingId` nulstilles
     først i `tap`, så arket forbliver åbent ved fejl.
   - Tilføj `loadStatus = computed(() => this.log.status())` og `reload()`.
6. **`features/weight/pages/weight-page`**:
   - `saving` og `errorKey` er lokale signals.
   - Knappen bruger `[loading]="saving()"` (`UiButton` har `loading`-input), og "Gemt ✓" vises først
     efter 2xx.
   - Fejl vises via `shared/components/ui-form-error`.
   - Under første indlæsning vises `UiSpinner`. Ved fejl vises `UiEmptyState` med en "Prøv igen"-knap.
   - Subscriptions bruger `takeUntilDestroyed`.
7. **`features/weight/components/weight-edit-sheet`**: nye inputs `busy` (loading på Gem/Slet) og
   `errorKey`. Outputs er uændrede.
8. **i18n** (`src/i18n/da.json` og `en.json`): `weight.page.saveError`, `weight.page.loadError`,
   `weight.page.retry`, `weight.editSheet.saveError`, `weight.editSheet.deleteError`.
9. **Tests (Vitest via `ng test`)** med `provideHttpClient()` og `provideHttpClientTesting()`:
   - `weight-log.spec.ts`:
     - `load` sender `GET …/me/weight-logs?limit=100` og mapper `{weightLogId: 7, weight: 72.4, recordedAt, recordedDate}` til `{id: '7', kg: 72.4, at}` (nyeste først).
     - `add` sender POST-body `{ weight: 74.2, recordedAt: TEST_NOW.toISOString() }`.
     - **409** med `existingWeightLogId: 42` fører til `PATCH …/42` med samme body, og vejningen med id `'42'` erstattes, så der ikke opstår dubletter.
     - `update` sender kun `{ weight }`.
     - `remove` sender `DELETE` og fjerner vejningen.
     - Når den sidste vejning slettes, hentes `GET latest`, og profilens vægt bliver startvægten.
     - En netværksfejl sætter `status = 'error'` og efterlader `entries` uændret.
     - Profilens vægt følger den nyeste vejning.
   - `weight-view.spec.ts` og `weight-page.spec.ts`: saving-tilstand, fejltekst, arket forbliver
     åbent ved fejl og lukker ved succes, samt load-, error- og retry-tilstand.
   - **UI-test mod docker-API'et** (`localhost:5210` via dev-proxy):
     1. Registrér en testbruger og verificér den.
     2. Gem en vejning (201).
     3. Gem igen samme dag, så 409→PATCH-stien bruges: listen har stadig én række med den nye vægt.
     4. Ret vejningen i arket.
     5. Slet den, så profilens vægt bliver startvægten.
     6. Tjek, at målet er genhentet.
10. **README'er**:
    - `features/weight/README.md`, afsnittene "Data" og "Beslutninger": "Der er ingen netværkskald" er
      ikke længere sandt. Beskriv loading- og error-state, 409→PATCH og startvægt-fallback.
    - `core/services/README.md`, rækken for `weight-log` og afhængighedsgrafen:
      `WeightLogService ► HttpClient, UserProfileService, (mål-service)`.

### Tværgående afhængigheder (løses i andre domæner)

- **Mål og kcal:** serveren genberegner målet (ny `UserGoal`) ved hver vejning, der bliver den nyeste,
  og kan selv skifte til `MaintainWeight`. Appens `AdaptiveGoalService` beregner stadig sit eget
  tilpassede kcal-mål lokalt. Mål-domænet skal beslutte, om appen viser serverens
  `targetDailyCalories` eller sin egen beregning. `profile.goal` og `goalWeightKg` skal i hvert fald
  genhentes efter vægt-mutationer.
- **Profil:** `startKg` (Hjem) og `kgLost` (præstationer) bør bruge `UserProfileDto.startingWeight`
  i stedet for den ældste lokale vejning.
- **Historik:** `GET /api/v1/me/history` returnerer `HistoryEventDto(type, occurredAt, referenceId)`
  **uden vægtværdien**, mens appen viser "{kg} kg" pr. vejning. Historik-domænet må enten bruge
  `WeightLogService.entries()` (de 100 nyeste plus "indlæs flere" med `cursor`) eller slå
  `GET /weight-logs/{referenceId}` op pr. hændelse (N+1).
- **Præstationer:** API'et har kun `TenWeights` for vægt. Appens "første vejning" skal mappes i
  præstations-domænet.

---

## 4. Gaps til API-teamet

API'et er ikke ændret. Vægt-domænet kan implementeres fuldt ud med de nuværende endpoints, så ingen
af punkterne blokerer.

- **[major, tværgående] Ingen CORS.** `Program.cs` har hverken `AddCors` eller `UseCors`. Appen
  kører fra `http://localhost:4200` (ng serve), `capacitor://localhost` (iOS) og
  `https://localhost` (Android). Browser-fetch mod `http://localhost:5210` bliver blokeret.
  Omvejen i appen er en dev-proxy og `CapacitorHttp`.
  _Forslag:_ `AddCors` med en policy for disse origins, der tillader `Authorization` og
  `Content-Type`, samt `app.UseCors(...)` før `UseAuthentication`.
- **[minor] Race på "én pr. dag" giver 500 i stedet for 409.** `CreateAsync` og `UpdateAsync`
  tjekker for dubletter _før_ `SaveChanges`. To samtidige POST'er samme dag rammer det unikke
  indeks `(UserId, RecordedDate)` og giver en `DbUpdateException`, som `GlobalExceptionHandler`
  mapper til `500 "Unexpected server error"`, ikke til `409` med `existingWeightLogId`. Det sker
  f.eks. ved dobbelttryk eller to enheder.
  _Forslag:_ fang unik-overtrædelsen (Npgsql `23505`) og kast `WeightDateConflictException`.
- **[minor] Intet "upsert pr. dag".** Appens regel "vej igen samme dag = erstat dagens vejning" kræver
  to kald: `POST`, som giver 409, og derefter `PATCH /{existingWeightLogId}`.
  _Forslag (nice-to-have):_ `PUT /api/v1/me/weight-logs/by-date/{yyyy-MM-dd}` med body
  `{ weight, recordedAt }`, der opretter eller erstatter dagens vejning. Alternativt
  `POST ?replaceExisting=true`.
- **[minor] `recordedAt` valideres ikke.** Et felt, der mangler, deserialiseres til
  `DateTime.MinValue` (år 1), fordi positional records med værdityper ikke får implicit
  `[Required]`, og det accepteres. Tider i fremtiden accepteres også og bliver dermed "nyeste",
  hvilket påvirker `/latest` og målberegningen. Tider uden offset tolkes som UTC.
  _Forslag:_ gør `recordedAt` required og afvis `> now + ~5 min` samt urimeligt gamle datoer med
  `400`.
- **[minor] Svaret afspejler ikke den gemte præcision.** Kolonnen er `numeric(5,2)`, men
  `ToDto(log)` returnerer værdien fra hukommelsen. POST med `72.345` svarer derfor `72.345`,
  mens den efterfølgende GET giver `72.35`.
  _Forslag:_ rund til 2 decimaler (`Math.Round(weight, 2)`) eller afvis mere end 2 decimaler.
- **[minor] Skjulte mål-ændringer ved hver vejning.** `RecalculateAsync(userId, force: true)`
  opretter en ny `UserGoal`-række og en `GoalUpdated`-historikhændelse _ved hver vejning_, der
  bliver den nyeste, også når intet i målet ændrer sig. Når målet er nået, skifter serveren
  lydløst Lose/Gain til `MaintainWeight`, og intet i `WeightLogDto` fortæller klienten det, så
  appen må genhente `GET /me/goals/current` efter hver mutation.
  _Forslag:_ brug `force: false`, så der kun oprettes en ny række, når målet faktisk ændrer sig, og
  returnér enten `goalChanged: bool` eller det aktuelle `UserGoalDto` i svaret (eller i et
  wrapper-svar).
- **[minor] OpenAPI er ufuldstændig.** Swagger siger `200` for `POST` (returnerer `201`) og for
  `DELETE` (returnerer `204`). `400`, `404` og `409`, samt `existingWeightLogId`-extensionen på
  409, er ikke dokumenteret.
  _Forslag:_ `[ProducesResponseType(StatusCodes.Status201Created)]`, `[ProducesResponseType(typeof(ProblemDetails), 409)]` og tilsvarende for de øvrige.
- **[minor] Ingen maskinlæsbar fejlkode i 400.** `BusinessValidationException` giver kun engelsk
  fritekst i `detail`, f.eks. "Weight must be between 25 and 400 kg.", "Complete a profile with a
  time zone before recording weight." og "The cursor is invalid.". Appen kan ikke vise en præcis,
  oversat besked uden at matche på teksten.
  _Forslag:_ en `code`-extension i ProblemDetails, f.eks. `weight_out_of_range`,
  `profile_timezone_missing` og `invalid_cursor`.
- **[minor] `recordedDate` bliver ikke genberegnet, når tidszonen ændres.** `RecordedDate` fastlåses
  ved skrivning ud fra profilens `TimeZoneId` på det tidspunkt. Ændrer brugeren tidszone med
  `PATCH /me/profile { timeZoneId }`, beholder eksisterende vejninger deres gamle dato. En ny
  vejning kan så give en uventet 409, eller to vejninger kan ende på samme lokale dag.
  _Forslag:_ dokumentér adfærden eller genberegn `RecordedDate`, når `TimeZoneId` ændres.
- **[minor, historik] Historik-hændelser mangler vægtværdien.** `HistoryEventDto(Type, OccurredAt, ReferenceId)`
  har ingen vægt, men appens historik viser "{kg} kg" for hver vejning.
  _Forslag:_ et valgfrit `summary` eller `value`-felt pr. hændelse, f.eks. `weight` for
  `WeightRecorded`.
