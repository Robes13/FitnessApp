# Services

Singletons (`providedIn: 'root'`). Stores er signal-baserede og gemmer via `StorageService`.

| Fil                       | Klasse                                               | Ansvar                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage.ts`              | `StorageService`                                     | Fejlsikker JSON-indpakning af `localStorage`. Kaster aldrig; advarer i konsollen. `clearAll()` sletter alle `STORAGE_KEY`-nøgler.                                                                                                                                                                                                                    |
| `theme.ts`                | `ThemeService`                                       | Mørk/lys tilstand på `<html data-theme>`, gemmes. Genskabes ved konstruktion; `initialize()` kan kaldes fra en app initializer.                                                                                                                                                                                                                      |
| `nutrition-calculator.ts` | `NutritionCalculator`                                | Rene beregninger: alder, BMR, træningsforbrug, kaloriemål (inkl. adaptiv tilpasning), makroer, målvægt, adgangskodestyrke, portioner.                                                                                                                                                                                                                |
| `adaptive-goal.ts`        | `AdaptiveGoalService`                                | Det daglige kaloriemål, appen viser og måler imod: formelmålet tilpasset madlog og vægtudvikling de sidste 21 dage (`kcalTarget`, `suggestedKcalTarget`, `adjustment`, `adjustmentKcal`, `suggestedAdjustmentKcal`). "I dag" er `FoodLogService.today`, så målet følger med over midnat.                                                             |
| `auth-api.ts`             | `AuthApi` + `AUTH_API_DELAY_MS`                      | Klienten til auth-backenden. Signup-kaldene er stubs med typede requests; resten fejler med en `ApiError`.                                                                                                                                                                                                                                           |
| `session.ts`              | `SessionService`                                     | Login-tilstand og e-mail-bekræftelse. Log ud rører ikke data; `deleteAccount()` sletter alt og genindlæser på login.                                                                                                                                                                                                                                 |
| `user-profile.ts`         | `UserProfileService`                                 | Profilen som ét signal plus `displayName`, `age`, `bmi`, `activityLevel` m.fl. Kaloriemålet ligger i `AdaptiveGoalService`.                                                                                                                                                                                                                          |
| `food-log.ts`             | `FoodLogService`                                     | Madlog pr. dag i 90 dage: dagens dato som signal (`today`, skifter ved midnat), dagens (`entries`, `totals`, `byMeal`), tidligere dage (`entriesFor`, `totalsFor`, `dailyTotals`, `allEntries`) og egne varer (`addCustomFood`, `updateCustomFood`, `hasCustomFoodNamed`).                                                                           |
| `food-search.ts`          | `FoodSearchService` + `FOOD_SEARCH_DELAY_MS`         | Søgning i brugerens egne varer, max 6. Der findes ingen varedatabase endnu.                                                                                                                                                                                                                                                                          |
| `barcode-scanner.ts`      | `BarcodeScannerService` + `BARCODE_SCANNER_PLATFORM` | Kameraet via `@capacitor-mlkit/barcode-scanning` bag interfacet `BarcodeScannerPlatform`. `scan()` kaster aldrig, men giver et `BarcodeScanOutcome` (`scanned`, `cancelled`, `permission-denied`, `unreadable`, `module-installing`, `unavailable`). `canScan` er `false` i browseren. `openSettings()`, og `recordScan()` tæller opslag til badget. |
| `product-lookup.ts`       | `ProductLookupService`                               | `lookup(barcode)` → `ProductLookupResult` (`found` / `not-found` / `error`). Open Food Facts API v2 via `HttpClient`, timeout `PRODUCT_LOOKUP_TIMEOUT_MS`, mapper `OpenFoodFactsProductResponse` til `ScannedProduct` (makroer pr. 100 g, `servingGrams`). Cacher fundne varer lokalt og spørger cachen først.                                       |
| `barcode-flow.ts`         | `BarcodeFlowService`                                 | Facade for stregkodescanneren i `shared/`: `scan`, `lookup` (tæller én scanning pr. opslag), `scale` (varen skaleret til en mængde i dens egen enhed), `isCustomFoodNameTaken` og `toCustomFood`. Holder domænelogikken ude af den delte komponent.                                                                                                  |
| `weight-log.ts`           | `WeightLogService`                                   | Vejninger nyeste først, `latest`, `weighedToday`, `add`/`update`/`remove` (højst én pr. dag), `entriesWithin`, grafens punkter (`seriesFor`). Holder profilens vægt lig seneste vejning.                                                                                                                                                             |
| `reminders.ts`            | `ReminderService`                                    | Brugerens påmindelser (morgenmad, frokost, aftensmad, vejning, dagens madlog): `settings`, `update`, `setMasterEnabled`, `requestPermission`, `permission`, `isDelivering`, `sync`. Planlægger lokale notifikationer via `REMINDER_NOTIFIER`.                                                                                                        |
| `reminder-notifier.ts`    | `REMINDER_NOTIFIER` + `CapacitorReminderNotifier`    | Tynd adapter om `@capacitor/local-notifications` bag interfacet `ReminderNotifier`, så `ReminderService` kan testes med en fake. Utilgængelig i browseren. Planlægger altid med `isExactNotification: false` (se "Påmindelser").                                                                                                                     |
| `keyboard.ts`             | `KeyboardService`                                    | Skærmtastaturets tilstand: `isOpen` og `inset`. Skriver `--keyboard-inset` og `data-keyboard="open"` på `<html>`, så app-roden krymper over tastaturet i stedet for at WebView'et skubbes, og scroller det fokuserede felt frem i sit eget scroll-område. Se "Tastaturet" i rod-README'en. |
| `keyboard-platform.ts`    | `KEYBOARD_PLATFORM` + `CapacitorKeyboardPlatform`    | Tynd adapter om `@capacitor/keyboard` bag interfacet `KeyboardPlatform`, så `KeyboardService` kan testes med en fake. Utilgængelig i browseren. `overlaysContent()` er kun sand på iOS; på Android ændrer systemet selv WebView'ets størrelse. |
| `collections.ts`          | `CollectionsService`                                 | Brugerens egne samlinger: `create`/`update`/`remove` (kun `isBase=false`) og `isNameTaken` (navne er unikke uden hensyn til store/små bogstaver og mellemrum; ellers kastes `DuplicateCollectionNameError`). `recipes` er tom, indtil backenden leverer retter.                                                                                      |

## Afhængigheder mellem services

```
SessionService ──► AuthApi
      └──────────► UserProfileService ──► NutritionCalculator
WeightLogService ► UserProfileService
AdaptiveGoalService ► UserProfileService, FoodLogService, WeightLogService, NutritionCalculator
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
- **`AuthApi` er klar til et API.** `register`, `resendVerification` og `checkVerification`
  bygger deres typede request (`models/auth.ts`) mod et endpoint i `AUTH_ENDPOINT` og svarer
  med en stubbet succes efter `AUTH_API_DELAY_MS` – `checkVerification` svarer "bekræftet".
  Appen selv træffer ingen beslutninger; når backenden findes, erstattes `stub()` med et
  `HttpClient`-kald til samme endpoint med samme body. Login og nulstilling af adgangskode
  fejler stadig med `NO_BACKEND`.
- **`completeSignup()`** markerer sessionen som logget ind men ubekræftet og "sender"
  bekræftelsesmailen via backenden. `AuthApi.register(profile, password)` kaldes af
  signup-flowet, der kender adgangskoden.
- **`checkVerification()`** spørger backenden. Svarer den `true`, markeres mailen som
  bekræftet; en feature kan også kalde `markEmailVerified()` direkte.
- **`seriesFor(range)`** er brugerens egne vejninger inden for intervallet, ældste først.
  Uden vejninger er den tom, og grafen viser sin tomme tilstand.
- **Forsinkelser** (`FOOD_SEARCH_DELAY_MS`, `AUTH_API_DELAY_MS`) er `InjectionToken`s med `providedIn: 'root'`-fabrik, så tests sætter dem til
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
- **Kaloriemålet** beregnes i tre lag:
  1. **Formel** (`maintenanceKcal`): Mifflin-St Jeor-BMR × PAL (fra skridt) + træning
     (`exerciseKcalPerDay`), afrundet til 10 kcal.
     Træning = dage/uge × minutter × (MET − 1) × kg / 60 / 7. MET pr. intensitet ligger i
     `TRAINING_MET` (mild 3,5 · moderat 5 · hård 8, fra _Compendium of Physical Activities_).
     Hvile-MET'en (1) trækkes fra, fordi BMR × PAL allerede dækker hvile i træningstiden. Uden
     valgt RPE bruges moderat; uden træningsdage er bidraget 0, så målet er som før.
  2. **Mål** (`suggestedKcalTarget`): + tempoets over-/underskud, aldrig under 1200 kcal.
  3. **Tilpasning** (`adaptiveAdjustment`, koblet af `AdaptiveGoalService`): over de sidste
     `ADAPTIVE_WINDOW_DAYS` (21) afsluttede dage – i dag tæller ikke med, hverken madlog eller
     vejninger, da dagen stadig logges, og mad og vægt skal dække de samme dage – estimeres det
     faktiske forbrug = snit af kcal på loggede dage − vægttrend (kg/dag,
     mindste kvadraters hældning) × 7700. Forskellen til formlen afrundes til 10 kcal, klemmes til
     ±`ADAPTIVE_MAX_ADJUSTMENT_KCAL` (300) og lægges til målet før 1200-gulvet. Kræver mindst 10
     loggede dage og mindst 2 vejninger med mindst 14 dages spænd; ellers ingen tilpasning.
     En dag tæller kun som logget, når dens kcal er mindst `ADAPTIVE_MIN_DAY_FRACTION` (50 %)
     af formlens forbrug – en halvt logget dag (glemt aftensmad) ville ellers få estimatet til
     at tro, at brugeren spiser mindre, end de gør. Grænsen følger formlen frem for
     `KCAL_MIN`, så den også passer til store forbrug. `kcalOverride` vinder altid.
     `adjustmentKcal`/`suggestedAdjustmentKcal` er den del af tilpasningen, der faktisk slår
     igennem efter 1200-gulvet, og Profil viser kun "tilpasset …", når den ikke er 0.

  `UserProfileService` kan ikke selv tilpasse målet, fordi `WeightLogService` afhænger af den
  (cirkulær afhængighed). Derfor læser Hjem, Mad og Profil `AdaptiveGoalService.kcalTarget`.

- **Persistens sker eksplicit** i hver mutation frem for via `effect()`, så rækkefølgen er
  deterministisk og testbar uden change detection.

`StorageService.write()` returnerer, om lagringen lykkedes.
`UserProfileService.updatePersisted()` bevarer den tidligere profil ved fejl;
profilbilledets editor bruger dette til at vise lagringsfejl uden at miste data.

`SessionService.deleteAccount()` (GDPR) nulstiller session og profil i hukommelsen, kalder
`StorageService.clearAll()` og genindlæser appen på login med `document.location.replace`.
Genindlæsningen nulstiller alle øvrige root-stores (madlog, vejninger, samlinger, tema) på
én gang, så de ikke hver skal have en reset-metode. Backendens slet-konto-kald hører til i
`deleteAccount()`, når API'et findes.

### Påmindelser

`ReminderService` gemmer indstillingerne under `STORAGE_KEY.REMINDERS`. Notifikationer
leveres kun, når brugeren er logget ind, profilens `notificationsEnabled` (hovedkontakten
"Notifikationer") er slået til, og platformen har givet lov.

- **Idempotent planlægning.** Hver type har et fast notifikations-id (1001–1005). En sync
  annullerer alle fem og planlægger de slåede til igen, så der aldrig opstår dubletter.
  Syncs køres én ad gangen i en kø.
- **Hvornår der synkroniseres.** Ved app-start (servicen oprettes i en app initializer, og
  dens `effect()` kører første gang), når indstillinger, hovedkontakt eller login-tilstand
  ændrer sig, efter en tilladelses-forespørgsel og når appen kommer i forgrunden igen
  (`visibilitychange`), så en tilladelse givet i telefonens indstillinger slår igennem.
- **Log ud og slet konto.** Log ud sætter `isLoggedIn` til `false`, og effekten annullerer
  alle påmindelser. Efter `deleteAccount()` er nøglen slettet, og genindlæsningen starter
  appen logget ud, så første sync annullerer alt. `SessionService` kender derfor ikke til
  påmindelser.
- **Tilladelse** bedes der kun om, når brugeren selv slår en påmindelse eller hovedkontakten
  til – aldrig ved app-start. Afviser brugeren, gemmes valgene, men intet planlægges.
- **Fejl** fra pluginet logges med `console.error` og vises som dansk tekst i `error`. En
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
