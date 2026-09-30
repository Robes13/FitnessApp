# Core

App-dækkende fundament uden afhængigheder opad: konstanter, typer, services, route guards og
rene hjælpefunktioner. `core` må **ikke** importere fra `shared/` eller `features/`.

## Mapper

| Mappe                                     | Indhold                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`constants/`](constants/README.md)       | Route-stier, storage-nøgler, måltider, ernæringsregler, profil-standarder. Ingen magic strings andre steder. |
| [`models/`](models/README.md)             | App-dækkende typer og interfaces, én fil pr. domæne.                                                         |
| [`services/`](services/README.md)         | Singletons (`providedIn: 'root'`): signal-baserede stores, API-klient og beregninger.                        |
| [`guards/`](guards/README.md)             | `authGuard` / `guestGuard` – kun routing-relateret adgangskontrol.                                           |
| [`interceptors/`](interceptors/README.md) | `authInterceptor` – Bearer-token og token-fornyelse på kald til API'et.                                      |
| [`utils/`](utils/README.md)               | Rene funktioner til dato- og talformatering, API-fejl og paginering samt `NOW`-tokenet.                      |
| [`testing/`](testing/README.md)           | Hjælpere til unit tests (falsk `DOCUMENT`, fast tid, 0 ms forsinkelser).                                     |

## Principper

- **Signals frem for RxJS-state.** Hver store holder sin tilstand i et privat `signal` og
  eksponerer det som `Signal<T>` plus `computed()`-afledninger. Observables bruges kun til
  asynkrone kald mod backenden.
- **Ét HTTP-lag.** Alle kald til FitnessApp-API'et går gennem `HttpClient` med
  `API_BASE_URL` (`constants/api.ts`) og relative endpoint-konstanter, fejler med en `ApiError`
  (`toApiError()` / `mapApiError()` i `utils/api.ts`) og får Bearer-tokenet af
  `authInterceptor`. Kald til `/me/**` venter på `SessionService.isAuthenticated()`; stores
  hentes af `SessionDataService`, når sessionen bliver `authenticated`.
- **Persistens via `StorageService`.** Stores gemmer eksplicit ved hver ændring og genskaber
  tilstanden i konstruktøren. Nøglerne står i `constants/storage-key.ts`.
- **Tid injiceres.** Alt der skal kende "nu" bruger `NOW` fra `utils/now.ts` i stedet for
  `new Date()`, så tests kan fastfryse tiden.
- **Forsinkelser er tokens.** Den kunstige svartid (`FOOD_SEARCH_DELAY_MS`) kan sættes til 0 i
  tests.
- **Native plugins bag tokens.** Capacitor-kald ligger i tynde adaptere bag et interface
  (`REMINDER_NOTIFIER`, `BARCODE_SCANNER_PLATFORM`), så specs kan give en fake.
- **Ingen demo-data.** Appen starter tom: der er hverken egen varedatabase, retter, faste samlinger
  eller seedede logs. Konto og session går mod FitnessApp-API'et (`AuthApi`); de øvrige data
  kommer fra brugeren, indtil deres domæne er koblet på API'et.

## Navngivning

Filer er kebab-case uden `.service`-suffiks: `services/food-log/food-log.ts` eksporterer
`FoodLogService`, `services/nutrition-calculator/nutrition-calculator.ts` eksporterer `NutritionCalculator`. Guards
hedder `<navn>.guard.ts`.
