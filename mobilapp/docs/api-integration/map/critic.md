# Kritik af mapping-rapporterne: dækning, modsigelser og stikprøver

> **Baggrund fra før integrationen.** Beslutningerne står i `../plan-v2.md`, som går forud for denne fil; status i `../README.md`.

Læst: alle otte rapporter i `docs/api-integration/map/` (`api-contract`, `auth-session-signup`,
`profile-goals-nutrition`, `weight`, `food`, `collections`, `reminders`,
`home-history-achievements`). Kontrolleret mod C#-koden i `API/` og app-koden i
`mobilapp/src/app`. Ingen filer i repoet er ændret.

Live-probe mod dev-containeren (`http://localhost:5210`, Development). Jeg oprettede en
engangsbruger med script `docs/api-integration/critic-probe/probe.py`, som ikke udskriver
loginoplysninger. Til sidst blev brugeren slettet, fordi `POST /me/consents/Terms/withdraw`
soft-sletter hele kontoen (se §3.1).

---

## 0. Resumé

- **Dækning:** alle 11 `STORAGE_KEY`-nøgler og alle core-services, der gemmer data, er
  dækket. Kun `ConsentsController` (`POST /me/consents` og `POST /me/consents/{type}/withdraw`)
  er ikke mappet. Det endpoint har en farlig sideeffekt: at trække Terms- eller
  HealthDataProcessing-samtykket tilbage **sletter kontoen**.
- **Stikprøver:** de 5 mest afgørende gaps, og 4 til, er **bekræftet** i C#. Ingen af dem er
  forkerte. Rettelserne handler om detaljer, alvorsgrad og planer, der modsiger hinanden.
- **Den vigtigste modsigelse:** food-rapporten gemmer måltidet som et fast klokkeslæt i
  `consumedAt`, men home-history-achievements og collections siger, at måltidet "ikke kan
  bevares". Hvis food-rapportens løsning bruges, skal den bruges overalt.
- **Nye gaps:** samtykke-tilbagetrækning sletter kontoen, `profileImageUrl` indeholder en
  SAS-token for hele containeren, en tredje fejlform (404 fra `NotFound()` uden `detail`),
  ingen idempotens på madlog-POST, race conditions på check-then-insert giver 500, og
  HealthDataProcessing-samtykke indsamles ikke ved oprettelse.

---

## 1. Dækning

### 1.1 App: lokale data og services

| Storage-nøgle / service                                                                  | Dækket af                    | Bemærkning                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `SESSION` / `SessionService`, `AuthApi`, `authGuard`                                     | auth-session-signup          | se §2, M8 (guards og status)                                                      |
| `PROFILE` / `UserProfileService`, `NutritionCalculator`, `AdaptiveGoalService`           | profile-goals-nutrition, hha |                                                                                   |
| `FOOD_LOG`, `CUSTOM_FOODS` / `FoodLogService`, `FoodSearchService`, `BarcodeFlowService` | food                         |                                                                                   |
| `WEIGHT_LOG` / `WeightLogService`                                                        | weight                       |                                                                                   |
| `COLLECTIONS` / `CollectionsService`                                                     | collections                  |                                                                                   |
| `THEME`, `LANGUAGE` / `ThemeService`, `LanguageService`                                  | profile-goals-nutrition §5   |                                                                                   |
| `REMINDERS` / `ReminderService`, `reminder-notifier`                                     | reminders                    |                                                                                   |
| `SCAN_COUNT` / `BarcodeScannerService`                                                   | hha (G9)                     | forbliver lokal                                                                   |
| `PRODUCT_CACHE` / `ProductLookupService` (Open Food Facts)                               | food                         | forbliver lokal, API'et har intet OFF                                             |
| `KeyboardService`, `BackButtonService`, `JsonTranslationLoader`                          | –                            | kun native eller bundle, ingen API-behov (i18n loades fra bundlen, ikke via HTTP) |

Appen har ingen UI til dataeksport, skift af adgangskode, "log ud overalt", samtykker,
sundheds- og skridtintegration eller push. De endpoints behøver derfor ingen mapping.

**Signup-vilkår:** oversigtstrinnet viser "servicevilkår" og "privatlivspolitik" som tekst og
ikke som links (`summary-step.html` l. 96–103). API'et har ingen dokument-URL'er eller
aktuelle versioner (se gap A2).

### 1.2 API-endpoints, som ingen rapport har mappet

| Endpoint                                                                                    | Status                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/me/consents` `{ consentType, documentVersion (1–50) }` → `201 UserConsentDto` | Ikke mappet. 409 `"This consent is already active."` (testet live).                                                                                                                                                                                                                                       |
| `POST /api/v1/me/consents/{consentType}/withdraw` → `204`                                   | Ikke mappet. **Ved `Terms` eller `HealthDataProcessing` kalder den `SoftDeleteAsync`**, dvs. kontoen slettes (`ConsentService.WithdrawAsync`, l. 75–79). Testet live: 204, derefter `GET /me` 401 og login 401. Ved `StepsIntegration` sættes `WithdrawnAt`, og `AllowStepsSharing` sættes til `"false"`. |

Kendte endpoints, som appen bevidst ikke bruger: `logout-all`, `password/change`,
`/me/data-export`, `/me/devices`, `goals/at`, `goals/{id}`, `goals/recalculate`,
`nutrition/history`, `foods` DELETE og servings GET/DELETE, `food-logs/{id}/restore`,
`settings/{key}` GET/DELETE, `profile` PUT, `profile/image` GET, `/metadata` og `/health`.
De er beskrevet i rapporterne.

---

## 2. Modsigelser mellem rapporterne, og hvad koden siger

| #   | Modsigelse                                                                                                                                                                                                                                                                                                                                                   | Afgørelse (kilde)                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **Måltid på madlog.** food §3.3 gemmer måltidet som fast lokalt klokkeslæt i `consumedAt` (8/12/15/18). hha siger "måltid kan ikke bevares" (Hjem-todos falder tilbage til én todo, historik-underteksten til `"{quantity} {unit}"`, gen-log med `consumedAt: now`). collections E9 sender `consumedAt: now()` og siger "det valgte måltid kan ikke gemmes". | Koden: `FoodLog` og alle DTO'er har intet måltid (bekræftet). **Vælges food-løsningen, skal den bruges overalt**: én fælles `mealSlotIso(day, meal)` / `mealFromConsumedAt()` i `core/`, samlingslog med `consumedAt = mealSlotIso(i dag, valgt måltid)`, gen-log med samme måltids slot i dag. Så virker Hjems måltids-todos og historikkens måltidsundertekst stadig. hha's forslag "no-late-snack = ingen `consumedAt` efter 21:00" virker ikke sammen med slots. |
| M2  | **404-body.** auth §2 siger `GET /me/profile` 404 "(tom body)". hha §0 siger ProblemDetails uden `detail`. api-contract §3 nævner kun to fejlformer.                                                                                                                                                                                                         | Controlleren bruger `NotFound()` under `[ApiController]` → **`application/problem+json` `{type, title:"Not Found", status:404, traceId}` uden `detail`** (testet live på `GET /me/goals/at?at=2000-01-01T00:00:00Z`). Det gælder `GET /me/profile`, `/me/goals/current` og `/me/goals/at`. `NotFoundException` giver derimod `application/json` `{title:"Resource not found", status, detail}`. hha har ret.                                                         |
| M3  | **Base-URL og stier.** weight: `API_BASE_URL` dev = `http://localhost:5210/api/v1/` (absolut). auth: `'/api/v1'` via proxy. profile: `''` bag proxy. food: `FOOD_API_PATH = '/api/v1/foods'`. reminders: `'/api/v1/me/reminders'`.                                                                                                                           | Uden CORS blokerer browseren en absolut URL til `:5210`. **Browser-dev: relativ `/api/v1` via `proxy.conf.json`. Native: absolut URL** (`http://10.0.2.2:5210/api/v1`, LAN-IP eller prod). CapacitorHttp sender kun absolutte URL'er gennem native HTTP. Relative URL'er går via WebView'ets fetch. Brug ét `API_BASE_URL`-token og endpoint-konstanter uden `/api/v1`-præfiks, ligesom den nuværende `AUTH_ENDPOINT`-konvention ("relative to the API's base URL"). |
| M4  | **Testbruger.** collections §5: "der er ingen SMTP i docker, så `EmailVerifiedAt` skal sættes i DB'en (5433)". food §5: "testbruger fra projektets seed".                                                                                                                                                                                                    | Begge er forkerte. I Development skriver `AccountMessageSender` mailen til `.dev-outbox` (mountet til `docs/api-integration/docker/outbox/`). Testet live: register → token fra outbox → verify → login. Der findes ingen seed-data (ingen `HasData` eller seed-script).                                                                                                                                                                                             |
| M5  | **Omvendt køn-mapping.** auth §4: `Other/Unspecified/PreferNotToSay → 'andet'`. profile §3: `Unspecified ↔ null`, `PreferNotToSay → null`.                                                                                                                                                                                                                   | `Gender.Unspecified = 0` er en gyldig værdi (`Enum.IsDefined`, register med `"Unspecified"` gav 201 live). auth-varianten mister information: `null` bliver `'andet'`, og den næste PATCH skriver `"Other"`. **Brug profile-varianten.** (Signup kræver et køn, så `null` opstår kun uden for signup.)                                                                                                                                                               |
| M6  | **CORS-alvorsgrad.** api-contract: blocker. De øvrige: major.                                                                                                                                                                                                                                                                                                | Appen kan køre uden API-ændring (proxy + CapacitorHttp), så **major**. CapacitorHttp er ikke testet af nogen, så det skal testes tidligt på en enhed.                                                                                                                                                                                                                                                                                                                |
| M7  | **`entryCount`** (hha G5, food #13, profile) beskrives som mangel.                                                                                                                                                                                                                                                                                           | Er kun en mangel, hvis man bruger `nutrition/days`. food-planen henter 90 dages `GET /me/food-logs`, og `FoodLogService.dailyTotals()` giver allerede `entryCount` pr. dag. Det dækker Hjems uge, 21 dages adaptivt mål og 32 dages streaks. Kan nedgraderes til nice-to-have.                                                                                                                                                                                       |
| M8  | **Hvornår data hentes.** reminders §4.3 kalder `load()`, når `session.isLoggedIn()` bliver `true`. auth §7 omdefinerer `isLoggedIn = status !== 'guest'`, som også dækker `'pending-verification'`, hvor der ingen tokens er.                                                                                                                                | Mens brugeren venter på verifikation, ville `GET/POST /me/reminders` give 401 (og interceptoren ville forsøge et refresh uden token). **Alle API-kald skal vente på `status === 'authenticated'`** (`isEmailVerified`), ikke på `isLoggedIn`. Det samme gælder load efter login i alle domæner.                                                                                                                                                                      |
| M9  | **Duplikerede hentninger.** hha henter selv ugens `weight-logs` og 90 dages `food-logs`/`weight-logs` til Hjem og Historik. weight og food lader `WeightLogService` (100 nyeste) og `FoodLogService` (90 dage) hente de samme data.                                                                                                                          | Genbrug servicerne (`entries()`, `allEntries()`, `dailyTotals()`), så der ikke kommer ekstra kald.                                                                                                                                                                                                                                                                                                                                                                   |
| M10 | **Kilde til kaloriemål.** profile §4: API-målet som basis, med `kcalOverride` og adaptiv justering stadig i klienten. hha §5: API-målet alene, adaptiv og override "står stille".                                                                                                                                                                            | Koden har ingen override og ingen adaptiv justering (bekræftet: `SettingKey` er et lukket enum, og `UserGoal` har ikke feltet). **Produktbeslutning for Janick.** Hjem, Mad og Profil skal bruge samme kilde.                                                                                                                                                                                                                                                        |
| M11 | Små forskelle                                                                                                                                                                                                                                                                                                                                                | DateTime-brøkdele: auth "7", hha "op til 6", api-contract "0–7" (api-contract har ret). Refresh-margin: 30 s (auth) mod 60 s (api-contract), begge fungerer. Omvendt tempo-mapping `0 →` `null` (auth) mod "behold lokalt" (profile): ved `MaintainWeight` er appens `pace` alligevel `null`.                                                                                                                                                                        |

Rapporterne er enige om enum-format, JSON-navne, auth-model, refresh-rotation og
401-håndtering, og koden bekræfter det: PascalCase-navne via `JsonStringEnumConverter` uden
naming policy, case-insensitive input, heltal accepteres, `[StringValue]` påvirker ikke JSON
og camelCase-egenskaber.

---

## 3. Stikprøver på de mest afgørende gaps

| Gap (rapport)                                                                       | Resultat                     | Belæg i C#                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ingen CORS (alle)                                                                   | **BEKRÆFTET**                | `Program.cs` har hverken `AddCors` eller `UseCors`. Pipelinen er `UseExceptionHandler → Swagger → UseHttpsRedirection → UseAuthentication → UseAuthorization`.                                                                                                                                                     |
| Ingen måltidstype på madlog (food, hha, collections)                                | **BEKRÆFTET**                | `Domain/Entities/FoodLog.cs`, `CreateFoodLogRequest`, `UpdateFoodLogRequest`, `FoodLogDto` og `LogMealCollectionRequest(ConsumedAt, Multiplier)` har intet måltidsfelt.                                                                                                                                            |
| Ingen tokens før e-mailverifikation, ingen status og samme 401 (auth, api-contract) | **BEKRÆFTET**, og lidt værre | `AuthService.LoginAsync` kaster `"Invalid email or password."` for `!IsActive \|\| EmailVerifiedAt is null`, **før** adgangskoden tjekkes. En 401 kan derfor ikke engang bekræfte adgangskoden. `OnTokenValidated` kræver `EmailVerifiedAt != null`. `VerifyEmailAsync` returnerer ingen tokens (controller: 204). |
| Kun egne fødevarer, `createdByMe` bruges ikke (food)                                | **BEKRÆFTET**                | `FoodService.SearchAsync`: `.Where(food => food.CreatedByUserId == userId)` altid, og parameteren `createdByMe` bruges ikke. `Food.CreatedByUserId` er `int` (ikke nullable), så der kan slet ikke findes system-fødevarer.                                                                                        |
| Ny `UserGoal` ved hver vejning og automatisk skift til Maintain (weight, hha G6/G8) | **BEKRÆFTET**                | `WeightLogService` l. 122–124, 160–162 og 179: `RecalculateAsync(userId, true, …)`. `UserGoalService.RecalculateAsync` l. 150–155 skifter til `MaintainWeight`, og med `force` springes lighedstjekket over (l. 161). `HistoryService` l. 28 laver et `GoalUpdated`-event pr. `UserGoal`-række.                    |
| Samlingslog = N løse logs (collections G3, food #18)                                | **BEKRÆFTET**                | `MealCollectionService.LogAsync` → `CreateManyAsync`. `FoodLog` har ingen reference til samlingen.                                                                                                                                                                                                                 |
| `MaintainWeight` kræver præcis lighed med den aktuelle vægt (profile)               | **BEKRÆFTET**                | `GoalCalculator`: `targetWeight != currentWeight` → 400. Ved register ignoreres feltet (`RegisterAsync` bruger `StartingWeight`), så api-contract har også ret.                                                                                                                                                    |
| E-mailskift låser brugeren ude med det samme (profile, auth)                        | **BEKRÆFTET**                | `UserAccountService.UpdateAsync` l. 55–76: `EmailVerifiedAt = null`, `IsActive = false`, refresh-tokens revokeres. `OnTokenValidated` afviser derefter det nuværende access token.                                                                                                                                 |
| `kcalOverride` kan ikke gemmes (profile, hha, auth)                                 | **BEKRÆFTET**                | `SettingKey` har 7 faste værdier, og `CreateUserGoalRequest`, `UserGoal` og `UserGoalDto` har intet override-felt.                                                                                                                                                                                                 |

**Ingen af de påståede gaps er forkerte.** Rettelserne i §5 handler om detaljer og om
modsigende planer.

### 3.1 Live-verificeret under kritikken

- `GET /me/goals/at?at=2000-01-01T00:00:00Z` → `404 application/problem+json`
  `{"type":"https://tools.ietf.org/html/rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"…"}`.
- `GET /me/profile/image` uden billede → `404 application/json` `{"title":"Resource not found","status":404,"detail":"Profile image not found."}`.
- `POST /me/consents {consentType:"HealthDataProcessing", documentVersion:"1"}` → 201. `Terms` igen → 409.
- `PUT /me/settings/Theme {value:"system"}` → 200. `"Dark"` → 400 `"Theme must be light, dark, or system."` (skelner mellem store og små bogstaver).
- `GET /me/nutrition/days?from=2026-09-01&to=2026-10-03` (32 dage, også dage i fremtiden) → 200. Dage før kontoen blev oprettet har `goal: null`.
- `POST /me/consents/Terms/withdraw` → 204, derefter `GET /me` → 401 og login → 401 `"Invalid email or password."`. **Kontoen er slettet.**
- Register med `"gender":"Unspecified"` → 201.

### 3.2 Andre fakta kontrolleret i koden

- Angular 22.1.7 `HttpParams` (`STANDARD_ENCODING_REPLACEMENTS` har `40, 3A, 24, 2C, 3B, 3D, 3F, 2F`, men ikke `2B`) **percent-encoder `+`**. Påstanden i api-contract §2 om det modsatte er forkert. Anbefalingen om at sende `Z` er stadig fin.
- `HistoryService.Encode` laver base64 af `"{ticks}:{(int)type}:{id}"`. Den indeholder kun cifre og `:`, og base64 af de bytes giver aldrig `+` eller `/`, kun `=`-padding. Angular lader `=` stå, og ASP.NET parser det korrekt. hha's påstand om "`+ / =`, skal URL-encodes" er derfor overdrevet.
- `AzureBlobProfileImageStorage.GetUrl` sætter den konfigurerede SAS på hver billed-URL. SAS'en har parametrene `sv, sr=c, si, sig`, altså **container-scope med en stored access policy**. Samme SAS for hele containeren sendes til alle klienter i `profileImageUrl` og i dataeksporten. Hvilke rettigheder policyen giver, er ikke tjekket (jeg brugte ikke tokenet).
- Unikke indekser: `Users.Email`, `Users.Username`, `(UserId, SettingKey)`, `(FoodId, Unit)`, `WeightLog (UserId, RecordedDate)`. `Food (CreatedByUserId, Name)` er **ikke** unik. Kun servicen tjekker navnet.

---

## 4. Tværgående app-arbejde, som ingen rapport ejer

Det er ikke API-gaps, men det skal ligge ét sted, før domænerne bygges:

1. **Én HTTP-kerne i `core/`:** `API_BASE_URL`, `proxy.conf.json` + `angular.json` `proxyConfig`,
   `CapacitorHttp` i `capacitor.config.ts` og cleartext til Android i dev, ét fælles `CursorPage<T>`,
   én `fetchAllPages()` og én `toApiError()`, der håndterer **tre** body-former og tom body (M2).
   Bearer-interceptoren sættes kun på `API_BASE_URL` (ikke Open Food Facts) med single-flight refresh.
2. **Session-bootstrap og -teardown:** én orkestrator, der efter `authenticated` (M8) kører
   `load()` i profil, mål, indstillinger, vægt, madlog, samlinger, påmindelser og præstationer,
   og som ved log ud eller sletning nulstiller hver service. I dag starter `ReminderService` i app
   initializeren. Efter log ud eller sletning skal de lokale notifikationer annulleres, ellers
   fyrer `daily-log` (default **on**, 21:00) videre for en udlogget bruger.
3. **Tidszone-sync:** ved bootstrap sendes `PATCH /me/profile { timeZoneId }`, hvis den afviger fra
   `Intl.DateTimeFormat().resolvedOptions().timeZone`. `timeZoneId` indgår ikke i `changed` i
   `UpsertAsync`, så det udløser ingen genberegning af målet. Allerede gemte `RecordedDate` flyttes ikke.
4. **Offline:** appen er offline-first i dag. Med API'et fejler alle skrivninger uden net, og
   ingen plan beskriver det samlet (kø, "prøv igen" eller blot fejltekst). Se gap A5 om idempotens.

---

## 5. Nye gaps til API-teamet

- **A1 [major] Tilbagetrækning af samtykke sletter kontoen i stilhed.**
  `POST /api/v1/me/consents/{Terms|HealthDataProcessing}/withdraw` kalder
  `UserAccountService.SoftDeleteAsync` og returnerer `204`. Det kræver ingen adgangskode, og det
  står ikke i Swagger. En fremtidig "privatliv/samtykke"-skærm kan komme til at slette kontoen.
  Forslag: afvis med `409` + henvisning til `DELETE /me`, eller kræv en eksplicit `confirmDeletion`
  og dokumentér det.
- **A2 [minor] HealthDataProcessing-samtykke indsamles ikke ved oprettelse, og der er ingen dokumentversioner.**
  `RegisterAsync` opretter kun `Terms` (`Consent:TermsVersion`, default `"1"`). `RegisterRequest`
  har intet felt til samtykke til behandling af helbredsdata (vægt, BMI), og ingen endpoints
  udstiller aktuelle versioner eller URL'er for vilkår og privatlivspolitik. Klienten må gætte
  `documentVersion` i `POST /me/consents`. Forslag: `acceptedHealthDataProcessing: bool` på
  `RegisterRequest` og `GET /api/v1/metadata` → `documents: [{ consentType, version, url }]`.
- **A3 [major, sikkerhed] `profileImageUrl` indeholder en SAS-token for hele containeren.**
  `AzureBlobProfileImageStorage.GetUrl` sætter den konfigurerede SAS (`sr=c`, stored access policy
  `si`) på alle URL'er, så alle klienter får den samme credential for hele containeren. Med læse- og
  list-rettigheder i policyen kan alle brugeres billeder ses. Forslag: en SAS pr. blob, kun læsning
  og kort levetid (`sr=b&sp=r&se=…`), eller at servere billedet via API'et. Tokenet ligger
  desuden committet i `appsettings.json`.
- **A4 [minor] Tredje fejlform: `NotFound()` uden `detail`.** `GET /me/profile`, `GET /me/goals/current`
  og `GET /me/goals/at` svarer `application/problem+json` `{type, title:"Not Found", status, traceId}`.
  Resten af API'et bruger `NotFoundException` → `application/json` `{title:"Resource not found", status, detail}`.
  Forslag: brug `NotFoundException` ("Profile not found.", "No current goal.") eller én
  ProblemDetails-form med en `code`-extension.
- **A5 [minor] Ingen idempotens på oprettelser.** `POST /me/food-logs` og `POST /me/meal-collections/{id}/log`
  har intet unikt indeks og ingen idempotensnøgle. Et retry efter timeout på mobilnettet giver
  dubletter. Vægt er beskyttet af "én pr. dag". Forslag: en `Idempotency-Key`-header eller et
  klientgenereret `clientRequestId` (unik pr. bruger), der returnerer den eksisterende ressource.
- **A6 [minor] Check-then-insert uden håndtering af unikhedsbrud giver 500.** Et dobbelttryk på
  `POST /auth/register` rammer det unikke indeks på `Email`/`Username`, og den første samtidige
  `PUT /me/settings/{key}` rammer `(UserId, SettingKey)`. Begge giver `DbUpdateException` → 500
  `"An unexpected error occurred."` i stedet for 409/200. `Food (CreatedByUserId, Name)` har intet
  unikt indeks, så samtidige opret giver dublet-navne på trods af reglen. Forslag: fang Npgsql `23505`
  og map til 409 (eller upsert), og tilføj et unikt indeks på `(CreatedByUserId, lower(Name))`.
  (Samme race på vægt er allerede rapporteret.)
- **A7 [minor] En vejning kan fejle på grund af målberegningen.** `WeightLogService` kører
  `RecalculateAsync` → `GoalCalculator.Calculate` i samme transaktion. Hvis profilen ikke længere
  består beregningens regler (f.eks. alder > 100 år), afvises selve vejningen med
  `400 "Age must be 13–100 years and height 100–250 cm."`. Forslag: gem vejningen uanset hvad, og
  lad en fejl i genberegningen blive logget i stedet for at rulle tilbage.

## 6. Rettelser til rapporterne

- **R1** auth-session-signup §2: `GET /me/profile` 404 har ikke tom body (se M2). api-contract §3
  skal have den tredje form med.
- **R2** collections §5 (test): e-mailverifikation kræver **ikke** et DB-hack. Tokenet ligger i
  `docs/api-integration/docker/outbox/*.txt` (M4).
- **R3** food §5 (test): der findes ingen seed-testbruger. Opret en via register og outbox (M4).
- **R4** weight §3: `API_BASE_URL` må ikke være absolut `http://localhost:5210` i browser-dev (M3).
- **R5** api-contract §2: Angular 22 `HttpParams` **encoder** `+` (§3.2).
- **R6** hha §1.4: historik-cursoren indeholder aldrig `+` eller `/` (§3.2).
- **R7** hha §2/§3 og collections §4: "måltid kan ikke bevares" gælder kun, hvis food-rapportens
  slot-løsning ikke bruges. Med den skal samlingslog og gen-log bruge `mealSlotIso` (M1).
- **R8** hha G5, food #13 og profile: `entryCount` er ikke nødvendig for appen (M7).
- **R9** auth §4: omvendt køn-mapping skal være `Unspecified ↔ null` (M5).
- **R10** reminders §4.3: `load()` skal vente på `authenticated`, ikke `isLoggedIn` (M8).
- **R11** api-contract §9: CORS er **major**, ikke blocker (M6).
