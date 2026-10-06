# Services

Singletons (`providedIn: 'root'`). Stores er signal-baserede; de lokale gemmer via `StorageService`, de API-baserede (`UserProfileService`, `FoodLogService`) henter og gemmer via API'et.

Hver service har sin egen mappe med implementering og tests. Tilhørende adaptere ligger sammen med servicen: `keyboard-platform.ts` i `keyboard/`, `system-bars-platform.ts` i `theme/` og `reminder-notifier.ts` med sine tests i `reminders/`.

| Fil                                            | Klasse                                                 | Ansvar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage/storage.ts`                           | `StorageService`                                       | Fejlsikker JSON-indpakning af `localStorage`. Kaster aldrig; advarer i konsollen. `clearAll(keep?)` sletter alle nøgler med `STORAGE_KEY_PREFIX` (også udgåede) undtagen `keep`.                                                                                                                                                                                                                                                                                                                                                                              |
| `theme/theme.ts`                               | `ThemeService`                                         | Mørk/lys tilstand på `<html data-theme>`, gemmes. Genskabes ved konstruktion; en app initializer opretter servicen, så temaet er sat før første skærm. Styler også systembarerne via `SYSTEM_BARS_PLATFORM`, så ikonerne følger appens tema og ikke telefonens. `holdDarkSystemBars()` holder ikonerne lyse for en skærm, der er mørk i begge temaer (fotoskærmene).                                                                                                                                                                                                                 |
| `language/language.ts`                         | `LanguageService`                                      | Appens sprog (ngx-translate). `initialize()` genskaber det gemte sprog i en app initializer; `set()` skifter live uden reload og gemmer valget. `<html lang>` og talformatet følger med.                                                                                                                                                                                                                                                                                                                                                                      |
| `language/translate.ts`                        | `injectTranslate()`                                    | Giver `t(key, params)` til TypeScript. Læser det aktive sprog, så `computed()` genberegnes ved sprogskift.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `language/translation-loader.ts`               | `JsonTranslationLoader`                                | Leverer `src/i18n/<sprog>.json` fra bundlen (dansk statisk, andre sprog som lazy chunk) – virker offline.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `nutrition-calculator/nutrition-calculator.ts` | `NutritionCalculator`                                  | Rene beregninger: alder, BMI, aktivitetsniveau, træning, tempo, målvægt, portioner. Ingen kalorie- eller makroformel – målene er API'ets.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `auth-api/auth-api.ts`                         | `AuthApi`                                              | HTTP-klienten til kontoens livscyklus: `register`, `login` (`{ emailOrUsername, password }`), `refresh`, `logout`, `resendVerification`, `forgotPassword` (begge `{ emailOrUsername }`), `deleteAccount` (`DELETE /me`), `createDataExportToken` og `withdrawTermsConsent`. API-formede bodies; fejler altid med en `ApiError`.                                                                                                                                                                                                                               |
| `auth-api/auth-mapping.ts`                     | –                                                      | Rene funktioner: `toRegisterRequest()` (signup-kladden → API'ets flade `RegisterRequest`) og fejl-resolverne `registerErrorKey` (409 skelnes på `detail`) og `loginErrorKey` (401/400 → forkerte oplysninger, 429 → for mange forsøg).                                                                                                                                                                                                                                                                                                                        |
| `session/session.ts`                           | `SessionService`                                       | Sessionen mod API'et: `status` (`guest` · `pending-verification` · `authenticated`), tokens, `register`, `login` (e-mail eller brugernavn; 403 → `pending-verification`), `checkVerification`, `resendVerification`, `logout`, `deleteAccount`, `withdrawConsent`, `accessToken()`, single-flight `refresh()` og `renewOnOpen()`. Log ud rører ikke lokale data.                                                                                                                                                                                              |
| `session-data/session-data.ts`                 | `SessionDataService` + `SESSION_DATA_STORES`           | Kalder `load()` på alle registrerede stores (profil, vægt, mad, samlinger, scanningstæller), når sessionen bliver `authenticated`, og `reset()`, når den bliver `guest`. Se [`session-data/README.md`](session-data/README.md).                                                                                                                                                                                                                                                                                                                               |
| `user-profile/user-profile.ts`                 | `UserProfileService`                                   | API-baseret `SessionDataStore`: profilen som ét signal plus `status`, `goal`, `targets` (API'ets kalorie- og makromål, afrundet), `calorieFloorApplied`, `displayName`, `age`, `bmi`, `activityLevel` m.fl. `load()`, `save(patch)` (routes pr. felt), `reloadGoal()`; `update`/`replace`/`resetToDefaults` kun i hukommelsen. Mapningen ligger i `profile-mapping.ts`. Se "Profil og kaloriemål".                                                                                                                                                            |
| `food-log/food-log.ts`                         | `FoodLogService`                                       | API-baseret `SessionDataStore`: brugerens katalog (`foods`, `customFoods`) og madlog for 90 dage (`status`, `today`, `entries`, `totals`, `byMeal` fra `mealType`, `entriesFor`, `dailyTotals`). Mutationer som `Observable`: `add`, `update` (kun mængden), `remove`, `addCustomFood`, `ensureFood`; `addLogs` lægger rækker ind. Se "Madloggen".                                                                                                                                                                                 |
| `food-log/food-log-mapping.ts`                 | –                                                      | Rene funktioner: `toFoodItem(FoodDto)` (basisportion fra servings, API'ets 2 decimaler – vælgeren afrunder én gang), `toLoggedFood(FoodLogDto)` (bruges også af historikken), `toPer100(makroer, mængde)` og `toApiUnit(token)`.                                                                                                                                                                                                                                                                                                                              |
| `food-catalogue/food-catalogue.ts`             | `FoodCatalogueService`                                 | API'ets fælles, skrivebeskyttede katalog (danske varer fra Open Food Facts, `createdByUserId: null`): `findByBarcode`, `search`. Fejler aldrig – et fejlet opslag er "intet fundet". Scanneren spørger det før Open Food Facts, og logning af en katalogvare genbruger den (ingen privat kopi). Tom i testmiljøerne (`test-providers.ts`).                                                                                                                                                                                                                    |
| `food-search/food-search.ts`                   | `FoodSearchService`                                    | Søgning i brugerens indlæste katalog og, fra 2 tegn, API'ets fælles katalog (`FoodCatalogueService`), max 6, egne varer først. Egne varer svarer straks; katalogets lægges til efter 300 ms pause i tastningen.                                                                                                                                                                                                                                                                                                                                               |
| `barcode-scanner/barcode-scanner.ts`           | `BarcodeScannerService` + `BARCODE_SCANNER_PLATFORM`   | Kameraet via `@capacitor-mlkit/barcode-scanning` bag interfacet `BarcodeScannerPlatform`. `scan()` kaster aldrig, men giver et `BarcodeScanOutcome` (`scanned`, `cancelled`, `permission-denied`, `unreadable`, `module-installing`, `module-unavailable`, `unavailable`). `canScan` er `false` i browseren. `openSettings()`, og `recordScan()` tæller opslag til badget. Tælleren er kontoens lokale data og en `SessionDataStore`: `load()` læser den fra storage, `reset()` glemmer den i hukommelsen, så en anden konto på enheden starter fra sin egen. |
| `product-lookup/product-lookup.ts`             | `ProductLookupService`                                 | `lookup(barcode)` → `ProductLookupResult` (`found` / `not-found` / `error`). Open Food Facts API v2 via `HttpClient`, timeout `PRODUCT_LOOKUP_TIMEOUT_MS`, mapper `OpenFoodFactsProductResponse` til `ScannedProduct` (makroer pr. 100 g, `servingGrams`). Cacher fundne varer i hukommelsen (pr. app-kørsel) og spørger cachen først.                                                                                                                                                                                                                                                |
| `barcode-flow/barcode-flow.ts`                 | `BarcodeFlowService`                                   | Facade for stregkodescanneren i `shared/`: `scan`, `lookup` (tæller én scanning pr. opslag; spørger brugerens katalog før Open Food Facts), `scale` (varen skaleret til en mængde i dens egen enhed). Holder domænelogikken ude af den delte komponent. Logges en scannet vare, opretter `FoodLogService.ensureFood` den.                                                                                                                                                                                                                                     |
| `weight-log/weight-log.ts`                     | `WeightLogService`                                     | Vejningerne fra API'et (`SessionDataStore`, `status`): nyeste først, `latest`, `add` (`POST`; 409 → `{ kind: 'exists', id }`), `update` (`PATCH`), `remove` (`DELETE`), `entriesWithin`, grafens punkter (`seriesFor`). Holder profilens vægt lig nyeste vejning og genindlæser målet efter hver ændring.                                                                                                                                                                                                                                     |
| `reminders/reminders.ts`                       | `ReminderService`                                      | Brugerens påmindelser (morgenmad, frokost, aftensmad, vejning, dagens madlog) – gemt på enheden: `settings`, `update`, `setMasterEnabled` (gemmer hovedkontakten i API'et), `requestPermission`, `permission`, `sync`. Planlægger lokale notifikationer via `REMINDER_NOTIFIER`.                                                                                                                                                                                                                                                              |
| `reminders/reminder-notifier.ts`               | `REMINDER_NOTIFIER` + `CapacitorReminderNotifier`      | Tynd adapter om `@capacitor/local-notifications` bag interfacet `ReminderNotifier`, så `ReminderService` kan testes med en fake. Utilgængelig i browseren. Planlægger altid med `isExactNotification: false` (se "Påmindelser").                                                                                                                                                                                                                                                                                                                              |
| `keyboard/keyboard.ts`                         | `KeyboardService`                                      | Skærmtastaturets tilstand: `isOpen` og `inset`. Skriver `--keyboard-inset` og `data-keyboard="open"` på `<html>`, så app-roden krymper over tastaturet i stedet for at WebView'et skubbes, og scroller det fokuserede felt frem i sit eget scroll-område. Se "Tastaturet" i rod-README'en.                                                                                                                                                                                                                                                                    |
| `keyboard/keyboard-platform.ts`                | `KEYBOARD_PLATFORM` + `CapacitorKeyboardPlatform`      | Tynd adapter om `@capacitor/keyboard` bag interfacet `KeyboardPlatform`, så `KeyboardService` kan testes med en fake. Utilgængelig i browseren. `overlaysContent()` er kun sand på iOS; på Android ændrer systemet selv WebView'ets størrelse.                                                                                                                                                                                                                                                                                                                |
| `back-button/back-button.ts`                   | `BackButtonService` + `BACK_BUTTON_PLATFORM`           | Androids tilbageknap og -gestus via `@capacitor/app`: lukker først det øverste ark eller scanneren (oversat til Escape, som de i forvejen lytter på), går ellers tilbage i historikken og minimerer kun appen på Hjem og login, eller når der ikke er mere at gå tilbage til. Startes fra en app initializer.                                                                                                                                                                                                                                                 |
| `theme/system-bars-platform.ts`                | `SYSTEM_BARS_PLATFORM` + `CapacitorSystemBarsPlatform` | Tynd adapter om Capacitors indbyggede `SystemBars`: lyse ikoner i mørkt tema, mørke i lyst. Gør intet i browseren. Specs giver en fake.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `collections/collections.ts`                   | `CollectionsService`                                   | API-baseret `SessionDataStore` (`me/meal-collections`): `status`, `collections` (varerne skaleret fra `FoodLogService.foods`), `collectionById`, `collectionTotals`, `isNameTaken` (kun i appen). Mutationer som `Observable`: `create`, `update` (diff), `remove`, `log(id, måltid)`. Se "Samlingerne".                                                                                                                                                                                                                                                      |
| `step-sync/step-sync.ts`                       | `StepSyncService`                                      | Spec 2.6 og 9.2-3a: skridt fra Apple Sundhed (iOS) / Health Connect (Android) som `SessionDataStore`: `available`, `enabled` (aktivt `StepsIntegration`-samtykke), `status`, `lastSync`, `source`. `load()` læser samtykket og synkroniserer, når det er tid (højst hver 30. dag pr. enhed); `enable()` / `disable()` giver og trækker samtykket. Se "Skridt fra Apple Sundhed / Health Connect".                                                                                                                                                             |
| `step-sync/health-platform.ts`                 | `HEALTH_PLATFORM` + `CapacitorHealthPlatform`          | Tynd adapter om `@capgo/capacitor-health` bag interfacet `HealthPlatform` (kun læsning af skridt), så `StepSyncService` kan testes med en fake. Utilgængelig i browseren.                                                                                                                                                                                                                                                                                                                                                                                     |

## Afhængigheder mellem services

```
SessionService ──► AuthApi ──► HttpClient (+ authInterceptor ──► SessionService, ved kald)
      └──────────► UserProfileService ──► HttpClient, NutritionCalculator
SessionDataService ► SessionService, SESSION_DATA_STORES
WeightLogService ► HttpClient, UserProfileService
FoodLogService ► HttpClient, ProductLookupService, NutritionCalculator
FoodSearchService ► FoodLogService
CollectionsService ► HttpClient, FoodLogService, NutritionCalculator
BarcodeFlowService ► BarcodeScannerService, ProductLookupService, FoodLogService, NutritionCalculator
ReminderService ─► SessionService, UserProfileService, REMINDER_NOTIFIER
StepSyncService ─► HttpClient, UserProfileService, HEALTH_PLATFORM
alle stores ─────► StorageService, NOW
```

Ingen service kender til `shared/` eller `features/`.

## Særlige beslutninger

- **Ingen seed.** Alle stores starter tomme. Skærmene viser deres tomme tilstand, indtil
  brugeren selv registrerer noget – eller indtil backenden leverer data.
- **Madloggen** (plan-v2 P11/P12). `load()` henter alle sider af `GET foods?limit=100`
  (brugerens katalog – API'ets fælles katalog listes aldrig her, det søges kun) og af
  `GET me/food-logs?from=<lokal dag i dag − 89>&to=<i morgen>&limit=100` parallelt og fejler
  aldrig (`status` `'error'`). Intet gemmes på enheden; lokale data fra før API'et migreres ikke.
  `entries` / `totals` / `byMeal` er dagens (måltidet er rækkens `mealType`); datoskift
  kontrolleres ved midnat, ved tilbagevenden til appen og før en logning. Rækkerne beholder
  API'ets præcise værdier (`numeric(7,2)`), så dagssummerne er de samme som API'ets
  (`me/nutrition`, dataeksporten). Skærmene afrunder først, når de viser et tal – én gang pr.
  række eller sum, aldrig før de lægger sammen. Katalogets varer (`customFoods`, `toFoodItem`)
  beholder ligeledes API'ets decimaler: vælgeren skalerer en portion fra dem og afrunder kun én
  gang, så forhåndsvisningen er det, API'et logger.
- **Pessimistiske mutationer.** Hukommelsen ændres først fra API'ets svar, og en fejl er en
  `ApiError` (`toApiError`) – eller `DuplicateCustomFoodNameError`, når `POST foods` giver 409.
  `add(food, meal)` = `ensureFood(food)` → `POST me/food-logs { foodId, quantity, unit,
consumedAt: nu, mealType }`. `update(logId, { quantity })` = `PATCH` af kun mængde og enhed
  (API'et genberegner og beholder måltidet; der er ingen `PATCH foods`). `remove` = `DELETE`;
  404 (allerede væk) fjerner rækken og fejler med `food.page.notFound`.
- **`ensureFood(item)`** finder eller opretter API-madvaren bag en vare: et katalog-id er den
  vare; en scannet vare (`off-<stregkode>`) er katalogvaren med samme stregkode eller en ny fra
  `ProductLookupService` (svarer fra sin cache) – 409 prøves én gang med `navn (brand eller
stregkode)`; alt andet (en ny egen vare, `food-…`, eller en samlingsvare under sit eget id) er
  katalogvaren med samme navn eller en ny ud fra varens egen portion (`toPer100`). Bagefter
  oprettes den serving, logningens enhed kræver (`SERVING_GRAMS_PER_UNIT`, `PUT` = upsert), hvis
  den mangler – så en halvt oprettet vare heles ved næste forsøg. Rækkefølgen er altid
  `POST foods` → `PUT servings` → `POST me/food-logs`.
- **Stregkoden på en egen vare** (3.1-6a). Kendte Open Food Facts ikke stregkoden, får den nye
  egne vare stregkoden med (`FoodItem.barcode` → `POST foods { barcode }`), og
  `BarcodeFlowService.lookup` slår stregkoden op i kataloget, før Open Food Facts spørges – så
  næste scanning finder brugerens egen vare (og en vare scannet før).
- **Egne varers navne er unikke** (trimmet, uden forskel på store/små bogstaver, via
  `normalizeName` i `utils/name.ts` – API'ets 409-regel). UI'et tjekker med
  `hasCustomFoodNamed` først; `DuplicateCustomFoodNameError` er reserven. `addCustomFood`
  genbruger en katalogvare med samme navn (som `ensureFood`), så et nyt forsøg efter en fejlet
  serving kun opretter servingen.
- **Vejninger** (plan-v2 P16). `load()` henter kun listen (`GET me/weight-logs?limit=100`, nyeste
  først, ikke `latest`) og følger `nextCursor` med `fetchAllPages`, så Hjems målfremskridt og
  "kg tabt"-præstationerne har den allerførste vejning – ét kald, til brugeren har over 100;
  `weightKg` sætter profilens `load()`. API'et tillader én vejning pr. kalenderdag i profilens
  tidszone: `add(kg)` sender altid `POST { weight, recordedAt: nu }` og svarer ved 409
  `{ kind: 'exists', id }` ud fra `existingWeightLogId` (læst med `readProblemBody`, så også
  CapacitorHttps streng-body virker) – der overskrives **aldrig** automatisk; skærmen spørger og
  kalder `update(id, kg, nu)`. Pessimistisk: listen ændres først efter API'ets svar. Efter hver
  ændring sættes `weightKg` til den nyeste vejning (ingen tilbage → `GET me/weight-logs/latest` =
  startvægten), og `reloadGoal()` henter målet, API'et har genberegnet. `reset()` rydder kun
  hukommelsen.
- **Samlingerne** (plan-v2 P13). `load()` henter alle sider af `GET me/meal-collections?limit=100`
  og fejler aldrig (`status` `'error'`). `MealItemDto` har ingen næring, så `collections` skalerer
  hver vare fra sin madvare i `FoodLogService.foods` (`…Per100` × gram / 100 med
  `NutritionCalculator.scaleMacros` – API'ets egen formel; uden madvaren 0). En vares `id` er
  `String(foodId)` og `mealItemId` API'ets id. `create` kører `ensureFood` for hver vare i
  rækkefølge og sender `POST { name, items }`. `update` er en diff: `PATCH` navnet, hvis det er
  ændret → `POST …/items` for hver vare uden `mealItemId` → `DELETE …/items/{id}` for hver gemt
  vare, kladden ikke har (efter POST'ene, så der altid er én tilbage) → `GET` samlingen. Den er
  ikke atomar: fejler et trin, hentes samlingen igen, og fejlen kastes videre. Er alle skrivninger
  gået igennem, er gemningen lykkedes, også hvis `GET` fejler – så sættes `status` til `'error'`,
  fordi hukommelsen kan have gamle `mealItemId`'er, og skærmene tilbyder en fuld genindlæsning.
  `remove` = `DELETE` (404 = allerede væk = fjernet; madlog-rækkerne bliver). `log(id, måltid)` =
  `POST …/{id}/log` med `{ consumedAt: nu, mealType, multiplier: 1 }` → `FoodLogService.addLogs()`.
  En 404 på `log` eller under `update` (slettet på en anden enhed) fjerner samlingen fra
  hukommelsen. Fejl er `ApiError`; den generelle "noget gik galt" bliver til
  `collections.saveError` / `collections.logError`. Navne er kun unikke i appen (`isNameTaken`).
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
  sprog), og profilen nulstilles. Samme konto igen beholder sine lokale data. Navn og e-mail
  kommer fra profilens `load()` (`GET me`), når sessionen bliver `authenticated`.
- **Oprettelse, login og bekræftelse.** `register()` sender `POST auth/register` og sætter
  sessionen til `pending-verification` – **intet** gensend-kald, da API'et selv har sendt mailen, og
  et gensend ugyldiggør det første link. `login(identifier, password)` sender
  `{ emailOrUsername, password }` (trimmet). Svarer API'et 403 (rigtig adgangskode, e-mailen er ikke
  bekræftet), completer det normalt og sætter `pending-verification` uden tokens (e-mail = den
  indtastede med små bogstaver, hvis den har `@`, ellers `null`). Identifikator og adgangskode holdes
  **kun i hukommelsen** (`pending`). `checkVerification()` logger ind med dem (API'et har intet
  status-endpoint): 200 = bekræftet og `authenticated` (`true`), 403 = ikke endnu (`false`); uden
  noget ventende er svaret `false`. 401 betyder, at adgangskoden ikke virker mere (fx nulstillet
  siden): så ender sessionen, og brugeren sendes til login (1.1-6a) – ellers ville hvert tjek tælle
  som et mislykket forsøg, og appen selv låse kontoen (429). `resendVerification()` sender den ventende identifikator (ellers
  sessionens e-mail). En gemt `pending-verification` genskabes efter en genstart som **gæst**, der
  beholder e-mail og konto-id – adgangskoden er væk, så brugeren logger ind igen og får arket (1.1-6a).
- **Token-fornyelse.** `accessToken()` fornyer 60 s før udløb (`TOKEN_REFRESH_MARGIN_MS`), og
  `refresh()` er single-flight (ét delt kald): dagens første fornyelse roterer refresh-tokenet
  (API'et beholder et token, der er udstedt samme UTC-dag), og et parallelt kald med det gamle ville
  få 401. Fornyelsen gøres færdig og gemmes, selv om alle kaldere afmelder sig undervejs; et svar,
  der lander efter log ud (eller et kontoskift), gemmes ikke. Afviser API'et fornyelsen (4xx), bliver
  sessionen gæst, og brugeren sendes til login; ved netværks- eller serverfejl beholdes sessionen.
- **Fornyelse ved app-start (spec 1.5).** `renewOnOpen()` kaldes af app-initializeren i
  `app.config.ts` før `SessionDataService`: er den gendannede session `authenticated`, fornyes den én
  gang (`refresh()`), og storenes første kald deler fornyelsen, hvis de skal bruge et token. Fejlen
  håndteres ikke yderligere: en afvist fornyelse har allerede sendt brugeren til login, og en
  netværksfejl beholder sessionen.
- **Log ud** venter på en igangværende fornyelse, fornyer tokenet om nødvendigt, sender
  `POST auth/logout` med det refresh-token, der er _aktuelt, når kaldet sendes_, og ender altid som
  gæst (best effort). Afviser API'et bearer-tokenet alligevel, fornyes én gang, og det nye
  refresh-token revokeres. E-mailen og konto-id'et huskes.
- **`seriesFor(range)`** er brugerens egne vejninger inden for intervallet, ældste først, hver med
  `position` på intervallets tidsakse (0 = start, 1 = nu), så grafen sætter dem på deres dato.
  Uden vejninger er den tom, og grafen viser sin tomme tilstand.
- **Stregkodescanning** bruger pluginets færdige `scan()`-UI. På Android er det Googles
  kodescanner (ingen kameratilladelse, men Googles stregkodemodul – mangler det, startes
  installationen, og udfaldet er `module-installing`). Modulet bedes der kun om én gang pr.
  app-kørsel: mangler det stadig bagefter, eller afviser Google anmodningen, er udfaldet
  `module-unavailable`, for en download, der fejler eller går i stå (ingen Play Butik, intet net,
  droslet), melder aldrig tilbage, og en ny anmodning ville bare gentage "prøv igen" i det
  uendelige. På iOS spørges om kameraadgang først.
  Pluginets afvisninger `scan canceled.` / `User denied access to camera.` oversættes til
  `cancelled` / `permission-denied`; alt andet logges og bliver `unreadable`.
- **Vareopslag**: status 0, HTTP 404 eller en vare helt uden energi er `not-found`;
  netværksfejl og timeout er `error` (logges). Browsere tillader ikke en egen `User-Agent`,
  så der sendes ingen. Fundne varer huskes i hukommelsen, så opslaget ved logning lige efter en
  scanning ikke henter varen igen; cachen er væk ved næste app-kørsel.
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
  træningsdage (→ de første N ugedage) og tre intensiteter (→ RPE 3/6/9). Profilbilledet: `uploadPhoto(blob)`
  sender den bagte JPEG som multipart-feltet `file` (`avatar.jpg`) med `PUT me/profile/image` og
  viser API'ets `profileImageUrl`; `deletePhoto()` = `DELETE me/profile/image` (404 = allerede
  væk = succes). En relativ `profileImageUrl` (Development: `/api/v1/dev-images/…`) gøres absolut
  mod `API_BASE_URL` ét sted, `toProfilePhoto()` i `profile-mapping.ts`, så de native apps henter
  billedet fra API'et og ikke fra WebView'ets egen oprindelse.

- **Persistens sker eksplicit** i hver mutation frem for via `effect()`, så rækkefølgen er
  deterministisk og testbar uden change detection.

`SessionService.deleteAccount()` (GDPR) sletter først kontoen i API'et (`DELETE /me`). **Kun
efter et 204** kalder den `StorageService.clearAll(DEVICE_STORAGE_KEYS)` – tema og sprog er
enhedsindstillinger (plan-v2 P9) og bevares, så login-skærmen beholder brugerens sprog – og
genindlæser appen på login med `document.location.replace`; ved en fejl slettes intet lokalt. `withdrawConsent()` (spec 9.2-3b)
gør det samme efter `POST me/consents/Terms/withdraw`: vilkårene omfatter behandlingen af
sundheds- og profildata, så API'et sletter og anonymiserer kontoen. Begge deler `wipeAndRestart()`. Genindlæsningen starter alle
root-stores forfra som gæst på én gang. Sessionen ændres bevidst ikke i hukommelsen først: så
ville stores reagere på skiftet (`SessionDataService` → `reset()`) og kunne skrive til storage
igen, før siden er væk.

### Skridt fra Apple Sundhed / Health Connect

`StepSyncService` (spec 2.6 og 9.2-3a) henter brugerens daglige skridt fra telefonens
sundhedsdata og sender **kun gennemsnittet** til API'et. Den er en `SessionDataStore` (i
`SESSION_DATA_STORES`), injicerer aldrig `SessionService`, og `reset()` rydder kun hukommelsen.

- **Tilgængelig** (`available`) kun på en telefon med sundhedsdataene (`HealthPlatform.isAvailable()`
  – i browseren `false`, og intet hentes). UI'et skjuler funktionen ellers.
- **Slået til** (`enabled`) = et aktivt `StepsIntegration`-samtykke, læst i `load()` med
  `GET me/consents?limit=50` (én side er nok: den nyeste `StepsIntegration`-række er den aktive).
- **Månedlig synkronisering (2.6)** ved hver `load()` (app-start og login), ingen scheduler: den er
  forfalden, når den er slået til, tilgængelig, og den seneste vellykkede er mindst 30 dage gammel
  eller aldrig sket. Datoen og værdien gemmes på enheden (`STORAGE_KEY.STEP_SYNC`), fordi
  sundhedsdataene er enhedens.
- **Synkroniseringen** venter først på, at profilens egen `load()` er færdig (ellers kunne dens
  ældre svar overskrive de nye skridt), og spørger så uden dialog om læseadgang
  (`hasStepsAccess`). Ingen adgang = 2.6-4a: intet hentes, `status` `no-permission`. Ellers dagssummer
  for de seneste **28** hele lokale dage (`queryAggregated`, `bucket: 'day'`); gennemsnittet over
  dagene med skridt. Under 7 sådanne dage = 2.6-3a (`insufficient`, intet ændres). Ellers
  `PUT me/profile/activity { dailySteps: round(snit), fromHealthIntegration: true }` (begrænset til
  `STEPS_MIN`–`STEPS_MAX`), profilens `stepsPerDay` fra svaret, `reloadGoal()` (API'et har genberegnet
  målet) og **først derefter** gemmes datoen (`synced`). En fejl i pluginet eller API'et = 2.6-3b:
  `failed`, datoen gemmes ikke, så næste app-start prøver igen. 4a og 3a gemmer heller ingen dato –
  skridtene læses altså ved hver app-start, indtil en synkronisering lykkes (privatlivsteksterne
  siger det samme).
- **Vinduet er 28 dage** (fire hele uger, så alle ugedage tæller lige meget) og ikke 30: Health
  Connect lader kun en app læse 30 dage tilbage fra dens første tilladelse, så den 30. dag ville være
  halv ved synkroniseringen lige efter, at funktionen er slået til.
- **Dagssummer:** HealthKits dagsspande er kalenderdage, Health Connects er faste 24 timer fra
  vinduets start. Over sommertidsskiftet i oktober ender vinduet derfor i en ekstra spand på én time.
  `totalsByLocalDay` i `health-platform.ts` lægger spandene sammen pr. lokal dato for spandens
  midtpunkt, så den time hører til den sidste dag og ikke tæller som en dag for sig.
- **`enable()`**: `requestStepsAccess()` (systemets dialog) → `POST me/consents { consentType:
"StepsIntegration", documentVersion: "1" }` (409 = allerede aktivt = fint) → synkronisering med det
  samme. Afvist adgang giver `false` – også når samtykket allerede er aktivt ("Giv adgang") – og
  intet ændres. Health Connect viser ikke dialogen igen efter to afvisninger; `openSettings()`
  (kun Android, `canOpenSettings`) åbner så Health Connects indstillinger.
- **`disable()`** (9.2-3a): `POST me/consents/StepsIntegration/withdraw` (404 = allerede væk = fint)
  → `enabled` `false`, ingen flere synkroniseringer. Aktivitetsniveauet bliver stående og rettes
  manuelt (2.5).
- **iOS** fortæller aldrig, om læsning er nægtet (privatliv): efter dialogen svarer HealthKit
  "givet", og en nægtet læsning giver bare ingen data. Ikke én dag med skridt er derfor på iOS
  `no-steps` (ikke `insufficient`), og rækken siger, hvor adgangen gives (Indstillinger →
  Anonymitet & sikkerhed → Sundhed → Nutrify). Samtykket er givet, for appen kan ikke se forskel.
  `no-permission` kommer på iOS kun, når appen aldrig har vist HealthKits ark på telefonen, mens
  samtykket er aktivt (geninstalleret app, ny telefon, eller slået til på Android). Så står Nutrify
  ikke under Sundhed → Dataadgang endnu, og rækken på Profil har derfor knappen "Giv adgang", der
  kalder `enable()` (arket → `POST me/consents`, 409 = fint → synkronisering). Den automatiske
  synkronisering spørger aldrig selv – på Android ville det åbne Health Connects dialog ved hver
  start.
- **`load()` fejler** (samtykket kunne ikke læses, f.eks. offline): `status` `error`, `enabled`
  `false`. Rækken på Profil siger det, låser kontakten (til eller fra er ukendt) og har "Prøv igen"
  (`load()` igen).

### Påmindelser

`ReminderService` gemmer indstillingerne under `STORAGE_KEY.REMINDERS` – bevidst kun på
enheden (plan-v2 P18, `// ponytail:`): API'ets `ReminderType` kender kun LogFood/LogWeight og
ingen ugedag, og spec 8.0/8.1 kræver ingen synkronisering. Notifikationer leveres kun, når
sessionen er `authenticated` (ikke mens e-mailen venter på bekræftelse), profilens
`notificationsEnabled` (hovedkontakten "Notifikationer") er slået til, og platformen har givet lov.

- **Hovedkontakten** gemmes i API'et: `setMasterEnabled(enabled)` returnerer
  `UserProfileService.save({ notificationsEnabled })` (`PUT me/settings/Notifications`) og er
  pessimistisk – profilen ændres, når API'et har svaret, og først da spørges der om lov (ved
  "til"). Fejler kaldet, ændres intet, og kalderen viser fejlen.
- **Kontoskift.** Servicens egen `effect()` følger `SessionService.status`: bliver sessionen
  `authenticated`, læses indstillingerne igen fra storage (en anden konto har fået storage ryddet
  af `forgetOtherAccount` og starter fra standardvalgene); bliver den `guest`, nulstilles de til
  `DEFAULT_REMINDER_SETTINGS` **kun i hukommelsen** – storage beholder dem til kontoens næste
  login. Servicen er bevidst ikke i `SESSION_DATA_STORES` (den oprettes efter sprogets
  initializer).

- **Idempotent planlægning.** Hver type har et fast notifikations-id (1001–1005). En sync
  annullerer alle fem og planlægger de slåede til igen, så der aldrig opstår dubletter.
  Syncs køres én ad gangen i en kø.
- **Hvornår der synkroniseres.** Ved app-start (servicen oprettes i sprogets app initializer,
  _efter_ at det gemte sprog er indlæst, og dens `effect()` kører første gang), når
  indstillinger, hovedkontakt, sessionens status eller sprog ændrer sig (notifikationernes titel
  og tekst slås op med `injectTranslate()`, når der planlægges), efter en tilladelses-forespørgsel og når appen kommer i forgrunden igen
  (`visibilitychange`), så en tilladelse givet i telefonens indstillinger slår igennem.
- **Log ud og slet konto.** Log ud gør sessionen til `guest`, og effekten annullerer
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
**planlægge** og følge kontoen (det skriver aldrig til storage), fordi hovedkontakten og
sessionen ejes af andre services.
