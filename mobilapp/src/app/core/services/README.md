# Services

Singletons (`providedIn: 'root'`). Stores er signal-baserede og gemmer via `StorageService`.

| Fil                       | Klasse                                       | Ansvar                                                                                                                          |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `storage.ts`              | `StorageService`                             | Fejlsikker JSON-indpakning af `localStorage`. Kaster aldrig; advarer i konsollen.                                               |
| `theme.ts`                | `ThemeService`                               | Mørk/lys tilstand på `<html data-theme>`, gemmes. Genskabes ved konstruktion; `initialize()` kan kaldes fra en app initializer. |
| `nutrition-calculator.ts` | `NutritionCalculator`                        | Rene beregninger: alder, BMR, kaloriemål, makroer, målvægt, adgangskodestyrke, portioner.                                       |
| `auth-api.ts`             | `AuthApi`                                    | Klienten til auth-backenden. Uden implementering fejler hvert kald med en `ApiError`.                                           |
| `session.ts`              | `SessionService`                             | Login-tilstand og e-mail-bekræftelse. Log ud rører ikke data.                                                                   |
| `user-profile.ts`         | `UserProfileService`                         | Profilen som ét signal plus `displayName`, `age`, `bmi`, `kcalTarget` m.fl.                                                     |
| `food-log.ts`             | `FoodLogService`                             | Dagens madlog (`entries`, `totals`, `byMeal`) og egne varer.                                                                    |
| `food-search.ts`          | `FoodSearchService` + `FOOD_SEARCH_DELAY_MS` | Søgning i brugerens egne varer, max 6. Der findes ingen varedatabase endnu.                                                     |
| `barcode-scanner.ts`      | `BarcodeScannerService` + `SCAN_DELAY_MS`    | Uden kamera og varedatabase ender hvert opslag som `unknown`. Tælleren gemmes.                                                  |
| `weight-log.ts`           | `WeightLogService`                           | Vejninger nyeste først, `latest`, `weighedToday`, grafens punkter (`seriesFor`).                                                |
| `collections.ts`          | `CollectionsService`                         | Brugerens egne samlinger. `recipes` er tom, indtil backenden leverer retter.                                                    |

## Afhængigheder mellem services

```
SessionService ──► AuthApi
      └──────────► UserProfileService ──► NutritionCalculator
WeightLogService ► UserProfileService
FoodSearchService ► FoodLogService
alle stores ─────► StorageService, NOW
```

Ingen service kender til `shared/` eller `features/`.

## Særlige beslutninger

- **Ingen seed.** Alle stores starter tomme. Skærmene viser deres tomme tilstand, indtil
  brugeren selv registrerer noget – eller indtil backenden leverer data.
- **Madloggen er dagens.** Den gemmes med dato; en ny dag starter tom. Egne varer gemmes
  separat og bliver ved. Datoskift kontrolleres ved midnat, ved tilbagevenden til appen
  og før ændringer i loggen, så gårsdagens mad aldrig gemmes som dagens.
- **`completeSignup()`** markerer sessionen som logget ind men ubekræftet og "sender"
  bekræftelsesmailen via backenden. `AuthApi.register(profile, password)` kaldes af
  signup-flowet, der kender adgangskoden.
- **`checkVerification()`** spørger backenden. Svarer den `true`, markeres mailen som
  bekræftet; en feature kan også kalde `markEmailVerified()` direkte.
- **`seriesFor(range)`** er brugerens egne vejninger inden for intervallet, ældste først.
  Uden vejninger er den tom, og grafen viser sin tomme tilstand.
- **Forsinkelser** er `InjectionToken`s med `providedIn: 'root'`-fabrik, så tests sætter dem til
  0 uden at ændre produktionskoden.
- **Persistens sker eksplicit** i hver mutation frem for via `effect()`, så rækkefølgen er
  deterministisk og testbar uden change detection.

`StorageService.write()` returnerer, om lagringen lykkedes.
`UserProfileService.updatePersisted()` bevarer den tidligere profil ved fejl;
profilbilledets editor bruger dette til at vise lagringsfejl uden at miste data.
