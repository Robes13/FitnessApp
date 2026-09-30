# Services

Singletons (`providedIn: 'root'`). Stores er signal-baserede; de lokale gemmer via `StorageService`, de API-baserede (`UserProfileService`) henter og gemmer via API'et.

Hver service har sin egen mappe med implementering og tests. Tilhørende adaptere ligger sammen med servicen: `keyboard-platform.ts` i `keyboard/`, `system-bars-platform.ts` i `theme/` og `reminder-notifier.ts` med sine tests i `reminders/`.

| Fil                                            | Klasse                                                 | Ansvar                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage/storage.ts`                           | `StorageService`                                       | Fejlsikker JSON-indpakning af `localStorage`. Kaster aldrig; advarer i konsollen. `clearAll(keep?)` sletter alle nøgler med `STORAGE_KEY_PREFIX` (også udgåede) undtagen `keep`.                                                                                                                                                                                                                   |
| `theme/theme.ts`                               | `ThemeService`                                         | Mørk/lys tilstand på `<html data-theme>`, gemmes. Genskabes ved konstruktion; `initialize()` kan kaldes fra en app initializer. Styler også systembarerne via `SYSTEM_BARS_PLATFORM`, så ikonerne følger appens tema og ikke telefonens. `holdDarkSystemBars()` holder ikonerne lyse for en skærm, der er mørk i begge temaer (fotoskærmene).                                                      |
| `language/language.ts`                         | `LanguageService`                                      | Appens sprog (ngx-translate). `initialize()` genskaber det gemte sprog i en app initializer; `set()` skifter live uden reload og gemmer valget. `<html lang>` og talformatet følger med.                                                                                                                                                                                                           |
| `language/translate.ts`                        | `injectTranslate()`                                    | Giver `t(key, params)` til TypeScript. Læser det aktive sprog, så `computed()` genberegnes ved sprogskift.                                                                                                                                                                                                                                                                                         |
| `language/translation-loader.ts`               | `JsonTranslationLoader`                                | Leverer `src/i18n/<sprog>.json` fra bundlen (dansk statisk, andre sprog som lazy chunk) – virker offline.                                                                                                                                                                                                                                                                                          |
| `nutrition-calculator/nutrition-calculator.ts` | `NutritionCalculator`                                  | Rene beregninger: alder, BMI, aktivitetsniveau, træning, tempo, målvægt, adgangskodestyrke, portioner. Ingen kalorie- eller makroformel – målene er API'ets.                                                                                                                                                                                                                                       |
| `auth-api/auth-api.ts`                         | `AuthApi`                                              | HTTP-klienten til kontoens livscyklus: `register`, `login`, `refresh`, `logout`, `verifyEmail`, `resendVerification`, `forgotPassword`, `resetPassword` og `deleteAccount` (`DELETE /me`). API-formede bodies; fejler altid med en `ApiError`.                                                                                                                                                     |
| `auth-api/auth-mapping.ts`                     | –                                                      | Rene funktioner: `toRegisterRequest()` (signup-kladden → API'ets flade `RegisterRequest`), `normalizeAuthToken()` / `isAuthToken()` og fejl-resolverne `registerErrorKey`, `loginErrorKey`, `emailErrorKey`, `tokenErrorKey`.                                                                                                                                                                      |
| `session/session.ts`                           | `SessionService`                                       | Sessionen mod API'et: `status` (`guest` · `pending-verification` · `authenticated`), tokens, `register`, `verifyEmail`, `checkVerification`, `login`, `logout`, `deleteAccount`, `accessToken()` og single-flight `refresh()`. Log ud rører ikke lokale data.                                                                                                                                      |
| `session-data/session-data.ts`                 | `SessionDataService` + `SESSION_DATA_STORES`           | Kalder `load()` på alle registrerede stores (profil, vægt, mad, samlinger), når sessionen bliver `authenticated`, og `reset()`, når den bliver `guest`. Se [`session-data/README.md`](session-data/README.md).                                                                                                                                                                                     |
| `user-profile/user-profile.ts`                 | `UserProfileService`                                   | API-baseret `SessionDataStore`: profilen som ét signal plus `status`, `goal`, `targets` (API'ets kalorie- og makromål, afrundet), `calorieFloorApplied`, `displayName`, `age`, `bmi`, `activityLevel` m.fl. `load()`, `save(patch)` (routes pr. felt), `reloadGoal()`; `update`/`replace`/`resetToDefaults` kun i hukommelsen. Mapningen ligger i `profile-mapping.ts`. Se "Profil og kaloriemål". |
| `food-log/food-log.ts`                         | `FoodLogService`                                       | Madlog pr. dag i 90 dage: dagens dato som signal (`today`, skifter ved midnat), dagens (`entries`, `totals`, `byMeal`), tidligere dage (`entriesFor`, `totalsFor`, `dailyTotals`, `allEntries`) og egne varer (`addCustomFood`, `updateCustomFood`, `hasCustomFoodNamed`).                                                                                                                         |
| `food-search/food-search.ts`                   | `FoodSearchService` + `FOOD_SEARCH_DELAY_MS`           | Søgning i brugerens egne varer, max 6. Der findes ingen varedatabase endnu.                                                                                                                                                                                                                                                                                                                        |
| `barcode-scanner/barcode-scanner.ts`           | `BarcodeScannerService` + `BARCODE_SCANNER_PLATFORM`   | Kameraet via `@capacitor-mlkit/barcode-scanning` bag interfacet `BarcodeScannerPlatform`. `scan()` kaster aldrig, men giver et `BarcodeScanOutcome` (`scanned`, `cancelled`, `permission-denied`, `unreadable`, `module-installing`, `unavailable`). `canScan` er `false` i browseren. `openSettings()`, og `recordScan()` tæller opslag til badget.                                               |
| `product-lookup/product-lookup.ts`             | `ProductLookupService`                                 | `lookup(barcode)` → `ProductLookupResult` (`found` / `not-found` / `error`). Open Food Facts API v2 via `HttpClient`, timeout `PRODUCT_LOOKUP_TIMEOUT_MS`, mapper `OpenFoodFactsProductResponse` til `ScannedProduct` (makroer pr. 100 g, `servingGrams`). Cacher fundne varer lokalt og spørger cachen først.                                                                                     |
| `barcode-flow/barcode-flow.ts`                 | `BarcodeFlowService`                                   | Facade for stregkodescanneren i `shared/`: `scan`, `lookup` (tæller én scanning pr. opslag), `scale` (varen skaleret til en mængde i dens egen enhed), `isCustomFoodNameTaken` og `toCustomFood`. Holder domænelogikken ude af den delte komponent.                                                                                                                                                |
| `weight-log/weight-log.ts`                     | `WeightLogService`                                     | Vejninger nyeste først, `latest`, `weighedToday`, `add`/`update`/`remove` (højst én pr. dag), `entriesWithin`, grafens punkter (`seriesFor`). Holder profilens vægt lig seneste vejning.                                                                                                                                                                                                           |
| `reminders/reminders.ts`                       | `ReminderService`                                      | Brugerens påmindelser (morgenmad, frokost, aftensmad, vejning, dagens madlog): `settings`, `update`, `setMasterEnabled`, `requestPermission`, `permission`, `isDelivering`, `sync`. Planlægger lokale notifikationer via `REMINDER_NOTIFIER`.                                                                                                                                                      |
| `reminders/reminder-notifier.ts`               | `REMINDER_NOTIFIER` + `CapacitorReminderNotifier`      | Tynd adapter om `@capacitor/local-notifications` bag interfacet `ReminderNotifier`, så `ReminderService` kan testes med en fake. Utilgængelig i browseren. Planlægger altid med `isExactNotification: false` (se "Påmindelser").                                                                                                                                                                   |
| `keyboard/keyboard.ts`                         | `KeyboardService`                                      | Skærmtastaturets tilstand: `isOpen` og `inset`. Skriver `--keyboard-inset` og `data-keyboard="open"` på `<html>`, så app-roden krymper over tastaturet i stedet for at WebView'et skubbes, og scroller det fokuserede felt frem i sit eget scroll-område. Se "Tastaturet" i rod-README'en.                                                                                                         |
| `keyboard/keyboard-platform.ts`                | `KEYBOARD_PLATFORM` + `CapacitorKeyboardPlatform`      | Tynd adapter om `@capacitor/keyboard` bag interfacet `KeyboardPlatform`, så `KeyboardService` kan testes med en fake. Utilgængelig i browseren. `overlaysContent()` er kun sand på iOS; på Android ændrer systemet selv WebView'ets størrelse.                                                                                                                                                     |
| `back-button/back-button.ts`                   | `BackButtonService` + `BACK_BUTTON_PLATFORM`           | Androids tilbageknap og -gestus via `@capacitor/app`: lukker først det øverste ark eller scanneren (oversat til Escape, som de i forvejen lytter på), går ellers tilbage i historikken og minimerer kun appen, når der ikke er mere at gå tilbage til. Startes fra en app initializer.                                                                                                             |
| `theme/system-bars-platform.ts`                | `SYSTEM_BARS_PLATFORM` + `CapacitorSystemBarsPlatform` | Tynd adapter om Capacitors indbyggede `SystemBars`: lyse ikoner i mørkt tema, mørke i lyst. Gør intet i browseren. Specs giver en fake.                                                                                                                                                                                                                                                            |
| `collections/collections.ts`                   | `CollectionsService`                                   | Brugerens egne samlinger: `create`/`update`/`remove` (kun `isBase=false`) og `isNameTaken` (navne er unikke uden hensyn til store/små bogstaver og mellemrum; ellers kastes `DuplicateCollectionNameError`). `recipes` er tom, indtil backenden leverer retter.                                                                                                                                    |

## Afhængigheder mellem services

```
SessionService ──► AuthApi ──► HttpClient (+ authInterceptor ──► SessionService, ved kald)
      └──────────► UserProfileService ──► HttpClient, NutritionCalculator
SessionDataService ► SessionService, SESSION_DATA_STORES
WeightLogService ► UserProfileService
FoodSearchService ► FoodLogService
BarcodeFlowService ► BarcodeScannerService, ProductLookupService, FoodLogService, NutritionCalculator
ReminderService ─► SessionService, UserProfileService, REMINDER_NOTIFIER
alle stores ─────► StorageService, NOW
```

Ingen service kender til `shared/` eller `features/`.

## Særlige beslutninger

- **Ingen seed.** Alle stores starter tomme. Skærmene viser deres tomme tilstand, indtil
  brugeren selv registrerer noget – eller indtil backenden leverer data.
- **Madloggen gemmes pr. dag.** Formatet er `{ days: { 'YYYY-MM-DD': LoggedFood[] } }`, og
  dage ældre end `FOOD_LOG_RETENTION_DAYS` (90, i dag medregnet) og tomme dage fjernes.
  Det gamle format `{ date, entries }` læses stadig og bliver til én dag. `entries` /
  `totals` / `byMeal` er altid dagens; kun dagens log kan ændres (`add` / `update` /
  `remove`), så en forældet redigering efter midnat ikke rører gårsdagen. Datoskift
  kontrolleres ved midnat, ved tilbagevenden til appen og før ændringer i loggen. Egne varer
  gemmes separat. `updateCustomFood` ændrer kun varen – allerede loggede poster beholder de
  tal, de blev logget med. Dage i storage, der ikke er et array, droppes ved indlæsning.
- **Egne varers navne er unikke** (trimmet, uden forskel på store/små bogstaver, via
  `normalizeName` i `utils/name.ts` – samme regel som samlinger). `addCustomFood` og
  `updateCustomFood` kaster `DuplicateCustomFoodNameError`; UI'et tjekker med
  `hasCustomFoodNamed` først. `addCustomFood(input, id?)` tager et valgfrit id, så vare-vælgeren
  kan bestemme id'et én gang, og den loggede post peger på den gemte egne vare.
- **Højst én vejning pr. dag.** `add` på en dag med vejninger genbruger den nyeste vejnings id
  og fjerner alle andre fra samme dag (ældre data kan have flere).
- **`AuthApi` er en tynd HTTP-klient.** Én metode pr. endpoint i `AUTH_ENDPOINT`, bodies som
  `models/auth.ts`, og `mapApiError(resolver)` gør alle fejl til en `ApiError` med en
  oversættelsesnøgle (fx 409 → "brugernavn/e-mail optaget", skelnet på API'ets engelske
  `detail`). Mapping og resolvere ligger som rene funktioner i `auth-mapping.ts`.
- **Session og tokens.** `SessionService` gemmer `{ status, email, userId, tokens }` under
  `STORAGE_KEY.SESSION` (ponytail: `localStorage`, sikker lagring er opgraderingsstien). Den gamle
  form `{ isLoggedIn, isEmailVerified }` og en session med udløbet refresh-token genskabes som
  gæst. `isLoggedIn` (= ikke gæst) bruges af guards; `isAuthenticated` (= har tokens, dvs. mailen
  er bekræftet) er det, alle `/me/**`-kald og stores venter på, og det, Hjems bekræftelsesark
  låser på.
- **Flere konti på samme enhed.** `userId` er den konto, der sidst oprettede sig eller loggede
  ind her, og huskes også som gæst. Opretter eller logger en _anden_ konto ind, ryddes den
  forriges lokale data først: alle `STORAGE_KEY`-nøgler undtagen `DEVICE_STORAGE_KEYS` (tema og
  sprog), og profilen nulstilles. Samme konto igen beholder sine lokale data. Tomt profilnavn og
  tom e-mail udfyldes fra kontoen.
- **Oprettelse og bekræftelse.** `register()` sender `POST auth/register` og sætter sessionen til
  `pending-verification` – **intet** gensend-kald, da API'et selv har sendt mailen, og et
  gensend ugyldiggør den første kode. Adgangskoden holdes kun i hukommelsen. `verifyEmail(token)`
  bekræfter og logger ind med den; uden den (appen er genstartet) bliver sessionen gæst, og
  brugeren sendes til login. Gik bekræftelsen igennem, men fejlede login bagefter, prøver det
  næste `verifyEmail()` kun login igen (koden er brugt). `checkVerification()` er et login-forsøg
  (200 = bekræftet, 401 = ikke endnu), fordi API'et intet status-endpoint har; uden adgangskoden
  fejler den med `AUTH_ERROR_MESSAGE_KEY.VERIFICATION_UNCHECKABLE` (indsæt koden eller log ind) i
  stedet for at svare "ikke bekræftet".
- **Token-fornyelse.** `accessToken()` fornyer 60 s før udløb (`TOKEN_REFRESH_MARGIN_MS`), og
  `refresh()` er single-flight (ét delt kald), fordi API'et roterer refresh-tokenet. Fornyelsen
  gøres færdig og gemmes, selv om alle kaldere afmelder sig undervejs; et svar, der lander efter
  log ud (eller et kontoskift), gemmes ikke. Afviser API'et fornyelsen (4xx), bliver sessionen
  gæst, og brugeren sendes til login; ved netværks- eller serverfejl beholdes sessionen.
- **Log ud** venter på en igangværende fornyelse, fornyer tokenet om nødvendigt, sender
  `POST auth/logout` med det refresh-token, der er _aktuelt, når kaldet sendes_, og ender altid som
  gæst (best effort). Afviser API'et bearer-tokenet alligevel, fornyes én gang, og det nye
  refresh-token revokeres. E-mailen og konto-id'et huskes.
- **`seriesFor(range)`** er brugerens egne vejninger inden for intervallet, ældste først.
  Uden vejninger er den tom, og grafen viser sin tomme tilstand.
- **Forsinkelser** (`FOOD_SEARCH_DELAY_MS`) er `InjectionToken`s med `providedIn: 'root'`-fabrik, så tests sætter dem til
  0 uden at ændre produktionskoden.
- **Stregkodescanning** bruger pluginets færdige `scan()`-UI. På Android er det Googles
  kodescanner (ingen kameratilladelse, men Googles stregkodemodul – mangler det, startes
  installationen, og udfaldet er `module-installing`). På iOS spørges om kameraadgang først.
  Pluginets afvisninger `scan canceled.` / `User denied access to camera.` oversættes til
  `cancelled` / `permission-denied`; alt andet logges og bliver `unreadable`.
- **Vareopslag**: status 0, HTTP 404 eller en vare helt uden energi er `not-found`;
  netværksfejl og timeout er `error` (logges). Browsere tillader ikke en egen `User-Agent`,
  så der sendes ingen. Cachen (`STORAGE_KEY.PRODUCT_CACHE`) holder højst
  `PRODUCT_CACHE_LIMIT` varer; de ældste ryger først. Cachen valideres ved læsning: forkert
  formede poster droppes (og slås op igen), og ældre poster uden `unit` læses som gram.
  - **Energi**: `energy-kcal_100g`; mangler den, bruges kJ (`energy-kj_100g`, ellers
    `energy_100g`, som Open Food Facts altid angiver i kJ) / `KJ_PER_KCAL` (4,184).
  - **Væsker**: er næringsværdierne pr. 100 ml (`nutrition_data_per` = `'100ml'`), eller er
    pakkens `quantity` angivet i ml/cl/l, får varen `unit: 'ml'` og mængden `'100 ml'`.
    Tallene regnes 1:1 som pr. 100 g (ingen massefylde) – det holder det simpelt.
- **Profil og kaloriemål** (plan-v2 P7–P9). `UserProfileService` gemmer intet på enheden.
  `load()` henter parallelt `GET me` (brugernavn, e-mail), `GET me/profile`,
  `POST me/goals/recalculate` (spec'ens "d. 1. i hver måned": API'et gemmer kun et nyt mål, når
  tallene har flyttet sig; fejler den, bruges `GET me/goals/current`), `GET me/settings`
  (`Notifications`, mangler den = til) og `GET me/weight-logs/latest` (`weightKg` – vægt-storen
  bygger på det). Fejler ét kald, bliver `status` `'error'`, og observablen fejler ikke.
  `save(patch)` er pessimistisk og sender pr. felt: profilfelter → `PATCH me/profile` +
  `reloadGoal()`; mål/tempo/målvægt → `POST me/goals` ("hold" = nuværende vægt og tempo 0; tabe/tage
  uden tempo = moderat; 409 = målet findes allerede = succes); notifikationer →
  `PUT me/settings/Notifications`; e-mail → `PATCH me` – den lokale e-mail bliver, til linket i
  mailen til den nye adresse er trykket (A5). Kalorie- og makromålet er **kun** API'ets
  (`targets`: `Math.round` af `UserGoalDto`, 0 før load). `calorieFloorApplied` er sand, når API'et
  har løftet målet til præcis `CALORIE_FLOOR_KCAL` for kønnet. API'et kender kun antal
  træningsdage (→ de første N ugedage) og tre intensiteter (→ RPE 3/6/9).

- **Persistens sker eksplicit** i hver mutation frem for via `effect()`, så rækkefølgen er
  deterministisk og testbar uden change detection.

`StorageService.write()` returnerer, om lagringen lykkedes.

`SessionService.deleteAccount()` (GDPR) sletter først kontoen i API'et (`DELETE /me`). **Kun
efter et 204** kalder den `StorageService.clearAll()` og genindlæser appen på login med
`document.location.replace`; ved en fejl slettes intet lokalt. Genindlæsningen starter alle
root-stores forfra som gæst på én gang. Sessionen ændres bevidst ikke i hukommelsen først: så
ville stores reagere på skiftet (`SessionDataService` → `reset()`) og kunne skrive til storage
igen, før siden er væk.

### Påmindelser

`ReminderService` gemmer indstillingerne under `STORAGE_KEY.REMINDERS`. Notifikationer
leveres kun, når brugeren er logget ind, profilens `notificationsEnabled` (hovedkontakten
"Notifikationer") er slået til, og platformen har givet lov.

- **Idempotent planlægning.** Hver type har et fast notifikations-id (1001–1005). En sync
  annullerer alle fem og planlægger de slåede til igen, så der aldrig opstår dubletter.
  Syncs køres én ad gangen i en kø.
- **Hvornår der synkroniseres.** Ved app-start (servicen oprettes i sprogets app initializer,
  _efter_ at det gemte sprog er indlæst, og dens `effect()` kører første gang), når
  indstillinger, hovedkontakt, login-tilstand eller sprog ændrer sig (notifikationernes titel
  og tekst slås op med `injectTranslate()`, når der planlægges), efter en tilladelses-forespørgsel og når appen kommer i forgrunden igen
  (`visibilitychange`), så en tilladelse givet i telefonens indstillinger slår igennem.
- **Log ud og slet konto.** Log ud sætter `isLoggedIn` til `false`, og effekten annullerer
  alle påmindelser. Efter `deleteAccount()` er nøglen slettet, og genindlæsningen starter
  appen logget ud, så første sync annullerer alt. `SessionService` kender derfor ikke til
  påmindelser.
- **Tilladelse** bedes der kun om, når brugeren selv slår en påmindelse eller hovedkontakten
  til – aldrig ved app-start. Afviser brugeren, gemmes valgene, men intet planlægges.
- **Fejl** fra pluginet logges med `console.error` og vises som tekst på appens sprog i `error` (nøglerne er `REMINDER_ERROR_KEY`). En
  fejl ved tilladelses-forespørgslen bliver stående, indtil tilladelsen ændrer sig (eller en
  ny forespørgsel lykkes) – ellers ville den sync, samme kontakt sætter i kø, nulstille den,
  før brugeren nåede at se den. En planlægningsfejl nulstilles af næste vellykkede sync.
- **Ikke-eksakte alarmer.** `@capacitor/local-notifications` 8.3+ har
  `isExactNotification: true` som standard, og så åbner hvert `schedule()` på Android 12+
  uden tilladelse til eksakte alarmer systemets "Alarmer og påmindelser". Da appen syncer ved
  hver `visibilitychange`, ville det give en endeløs løkke. Påmindelserne planlægges derfor
  med `isExactNotification: false` (og `second: 0`); et par minutters forsinkelse er fint.
- I browseren er `permission` `unsupported`, og pluginet kaldes slet ikke.

Undtagelsen fra "persistens sker eksplicit": `ReminderService` bruger ét `effect()` til at
**planlægge** (ikke gemme), fordi hovedkontakten og login-tilstanden ejes af andre services.
