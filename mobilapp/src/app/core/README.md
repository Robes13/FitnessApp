# Core

App-dækkende fundament uden afhængigheder opad: konstanter, typer, services, route guards og
rene hjælpefunktioner. `core` må **ikke** importere fra `shared/` eller `features/`.

## Mapper

| Mappe                               | Indhold                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`constants/`](constants/README.md) | Route-stier, storage-nøgler, måltider, ernæringsregler, profil-standarder. Ingen magic strings andre steder. |
| [`models/`](models/README.md)       | App-dækkende typer og interfaces, én fil pr. domæne.                                                         |
| [`services/`](services/README.md)   | Singletons (`providedIn: 'root'`): signal-baserede stores, API-klient og beregninger.                        |
| [`guards/`](guards/README.md)       | `authGuard` / `guestGuard` – kun routing-relateret adgangskontrol.                                           |
| [`utils/`](utils/README.md)         | Rene funktioner til dato- og talformatering samt `NOW`-tokenet.                                              |
| [`testing/`](testing/README.md)     | Hjælpere til unit tests (falsk `DOCUMENT`, fast tid, 0 ms forsinkelser).                                     |

## Principper

- **Signals frem for RxJS-state.** Hver store holder sin tilstand i et privat `signal` og
  eksponerer det som `Signal<T>` plus `computed()`-afledninger. Observables bruges kun til
  asynkrone kald mod backenden.
- **Persistens via `StorageService`.** Stores gemmer eksplicit ved hver ændring og genskaber
  tilstanden i konstruktøren. Nøglerne står i `constants/storage-key.ts`.
- **Tid injiceres.** Alt der skal kende "nu" bruger `NOW` fra `utils/now.ts` i stedet for
  `new Date()`, så tests kan fastfryse tiden.
- **Forsinkelser er tokens.** De kunstige svartider (`FOOD_SEARCH_DELAY_MS`, `SCAN_DELAY_MS`)
  kan sættes til 0 i tests.
- **Ingen demo-data.** Appen starter tom: der er hverken varedatabase, retter, faste samlinger
  eller seedede logs, og `AuthApi` har endnu ingen backend at kalde. Alt indhold kommer fra
  brugeren, indtil et API er koblet på.

## Navngivning

Filer er kebab-case uden `.service`-suffiks: `services/food-log.ts` eksporterer
`FoodLogService`, `services/nutrition-calculator.ts` eksporterer `NutritionCalculator`. Guards
hedder `<navn>.guard.ts`.
