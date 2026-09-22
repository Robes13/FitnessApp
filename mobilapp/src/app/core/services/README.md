# Services

Singletons (`providedIn: 'root'`). Stores er signal-baserede og gemmer via `StorageService`.

| Fil                       | Klasse                                       | Ansvar                                                                                                                          |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `storage.ts`              | `StorageService`                             | Fejlsikker JSON-indpakning af `localStorage`. Kaster aldrig; advarer i konsollen.                                               |
| `theme.ts`                | `ThemeService`                               | Mørk/lys tilstand på `<html data-theme>`, gemmes. Genskabes ved konstruktion; `initialize()` kan kaldes fra en app initializer. |
| `nutrition-calculator.ts` | `NutritionCalculator`                        | Rene beregninger: alder, BMR, kaloriemål, makroer, målvægt, adgangskodestyrke, portioner.                                       |
| `auth-api.ts`             | `AuthApi` + `AUTH_API_DELAY_MS`              | Mock-backend. Svarer efter en forsinkelse; fejler med `ApiError`.                                                               |
| `session.ts`              | `SessionService`                             | Login-tilstand og e-mail-bekræftelse. Log ud rører ikke data.                                                                   |
| `user-profile.ts`         | `UserProfileService`                         | Profilen som ét signal plus `displayName`, `age`, `bmi`, `kcalTarget` m.fl.                                                     |
| `food-log.ts`             | `FoodLogService`                             | Dagens madlog (`entries`, `totals`, `byMeal`) og egne varer.                                                                    |
| `food-search.ts`          | `FoodSearchService` + `FOOD_SEARCH_DELAY_MS` | Søgning i egne varer + `FOOD_DATABASE`, max 6.                                                                                  |
| `barcode-scanner.ts`      | `BarcodeScannerService` + `SCAN_DELAY_MS`    | Dummy-scanner: skiftevis fundet/ukendt, gemt tæller.                                                                            |
| `weight-log.ts`           | `WeightLogService`                           | Vejninger nyeste først, `latest`, `weighedToday`, syntetisk graf (`seriesFor`).                                                 |
| `collections.ts`          | `CollectionsService`                         | Retter og samlinger; faste samlinger + brugerens egne.                                                                          |

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

- **Seed ved første kørsel.** `FoodLogService` seeder designets to varer, og `WeightLogService`
  seeder tre vejninger (3/7/14 dage siden), når der intet ligger i storage. Det giver en
  udfyldt Hjem-skærm første gang. Er der data, seedes der aldrig igen.
- **Madloggen er dagens.** Den gemmes med dato; en ny dag starter tom (uden nyt seed).
  Egne varer gemmes separat og bliver ved.
- **`completeSignup()`** markerer sessionen som logget ind men ubekræftet og "sender"
  bekræftelsesmailen via mock-backenden. `AuthApi.register(profile, password)` kaldes af
  signup-flowet, der kender adgangskoden.
- **`checkVerification()`** returnerer altid `false` (designets "Ikke bekræftet"). Skal en
  feature låse op, kaldes `markEmailVerified()`.
- **`seriesFor()`** er ikke rigtige data, men designets syntetiske kurve (`pts`): 12 punkter
  med drift efter mål og en sinusbølge. Rigtige vejninger ligger i `entries`.
- **Forsinkelser** er `InjectionToken`s med `providedIn: 'root'`-fabrik, så tests sætter dem til
  0 uden at ændre produktionskoden.
- **Persistens sker eksplicit** i hver mutation frem for via `effect()`, så rækkefølgen er
  deterministisk og testbar uden change detection.
