# Integrationsplan: mobilapp → eksisterende FitnessApp API

Bindende beslutninger for alle implementerings-agenter. Detaljerne pr. domæne står i
`docs/api-integration/map/<domæne>.md`; `docs/api-integration/map/critic.md` retter rapporterne og går forud for dem.
`docs/api-integration/map/api-contract.md` er kontrakt-referencen (JSON, fejlformer, auth, paginering).

## Rammer

- API'et i `../API` må **ikke** ændres. Det kører i Docker på `http://localhost:5210`
  (compose: `docs/api-integration/docker/compose.yml`, Development). Mails (verifikations-/reset-tokens)
  lander i `docs/api-integration/docker/outbox/*.txt`. Swagger: `docs/api-integration/docker/swagger.json`.
- Følg `mobilapp/ARCHITECTURE.md` og `CLAUDE.md` (i18n-nøgler i da+en, tokens, BEM, OnPush, signals,
  ingen `any`, ingen magic strings, README'er opdateres, `features → shared → core`).
- **Ponytail**: laveste trin på stigen. Ingen nye npm-afhængigheder. Genbrug eksisterende
  services/komponenter (`UiButton` har `loading`, `UiFormError`, `UiEmptyState`, `UiSpinner` m.fl.).
  Ingen lokal cache/offline-kø (YAGNI) – API'et er sandheden; `localStorage` kun for det, API'et
  ikke kan gemme (markér med `// ponytail:` + henvisning til gap).
- Commits kun lokalt på feature-branches som beskrevet under "Parallelt arbejde". Aldrig push.
- Kodekommentarer på engelsk, README/dokumentation på dansk.
- Test: `cd mobilapp && npx ng test --watch=false` (vitest). `npx ng build` skal være fri for fejl
  og advarsler. HTTP-specs bruger `provideHttpClient()` + `provideHttpClientTesting()` +
  `HttpTestingController`.

## Fælles kerne (bygges i bølge 0 – genbrug den)

- `API_BASE_URL` (InjectionToken, `core/constants/api.ts`): browser `/api/v1` (dev-proxy
  `proxy.conf.json` → `http://localhost:5210`), native absolut dev-URL. Endpoint-konstanter er
  **relative** til base-URL'en (f.eks. `'me/weight-logs'`), ligger i domænets `core/constants/*.ts`.
- `CursorPage<T>`, `ProblemDetails` i `core/models/api.ts`. `fetchAllPages()` og `toApiError()`
  (tre fejlformer + tom body + status 0) i `core/utils/api.ts`.
- Auth-interceptor (Bearer kun til `API_BASE_URL`, single-flight refresh, retry én gang).
- `SessionService.status`: `'guest' | 'pending-verification' | 'authenticated'`.
  **Alle API-kald til `/me/**` venter på `authenticated`** (ikke `isLoggedIn`).
- `SessionDataService` (`core/services/session-data/`): når status bliver `authenticated`, kaldes
  `load()` på hver registreret store; når den bliver `guest`, kaldes `reset()`. Hver domæne-agent
  tilføjer sin store til listen i den fil. Stores henter **aldrig** ved konstruktion.
- Stores udstiller `status: Signal<'idle' | 'loading' | 'ready' | 'error'>` og muterer
  **pessimistisk** (state opdateres fra serverens svar), så UI'et kan vise loading/fejl.

## Parallelt arbejde (bølge 1+)

Hver domæne-agent arbejder i sit **eget git-worktree** på branchen `feat/api-integration`
(lokal, pushes aldrig). Symlink `mobilapp/node_modules` fra hovedtræet
(`/Users/janick/Documents/GitHub/FitnessApp/mobilapp/node_modules`) i stedet for `npm ci`; virker
build/test ikke med symlink, så `npm ci`. Commit til sidst på en egen branch
`wave<N>/<domæne>` med Conventional Commits på dansk (`feat(weight): …`), **uden** Co-Authored-By
eller anden AI-attribution. Push aldrig. Hold dig til dit domænes filer; fælles filer
(`src/i18n/*.json`, `core/services/README.md`, `core/constants/storage-key.ts`,
`core/services/session-data/session-data.ts`) ændres med små, lokale indsættelser (i18n-nøgler
under dit eget afsnit), så merges bliver trivielle. UI-test i browseren sker efter merge.

### Kontrakter mellem domæner (bølge 1 bygger parallelt op imod dem)

- `UserProfileService.update(patch)` forbliver en **synkron, lokal** setter (bruges af vægt til
  `weightKg` og af session til `username`). API-skrivninger går gennem en ny
  `save(patch): Observable<void>` (profil-agenten). `weightKg` er aldrig et API-profilfelt.
- `UserProfileService.reloadGoal(): Observable<void>` findes som stub i basen; profil-agenten
  implementerer den (henter `GET me/goals/current`), vægt-agenten kalder den efter hver vellykket
  vægt-mutation (serveren genberegner målet).
- `core/utils/meal-slot.ts` (`mealSlotIso(day, meal)`, `mealFromConsumedAt(iso)`) laves af
  mad-agenten; samlinger/historik/hjem (bølge 2) genbruger den.
- `FoodLogService` beholder sine offentlige signals (`entries`, `byMeal`, `totals`,
  `dailyTotals`, `allEntries`, `customFoods` …); mutationer bliver `Observable`. Bølge 2 bygger på det.
- `WeightLogService` beholder `entries`, `latest`, `weighedToday` m.fl.; mutationer bliver `Observable`.

## Produktbeslutninger (defaults – Janick kan ændre dem)

1. **Kaloriemål:** API-målet (`GET /me/goals/current`, `targetDailyCalories` + makrogram) er
   basis. `kcalOverride` og den adaptive justering bevares i appen oven på API-basen
   (`kcalTarget = kcalOverride ?? round(api) + adaptiveAdjustment`); makroer skaleres
   proportionalt fra API'ets gram. Override gemmes lokalt (gap). Forhåndsvisning før konto
   (signup) bruger appens egen formel som i dag.
2. **Måltid på madlog:** kodes som fast lokalt klokkeslæt i `consumedAt`
   (`MEAL_SLOT_HOUR = { morgen: 8, frokost: 12, snack: 15, aften: 18 }`), læses tilbage med
   `mealFromConsumedAt` (< 11 morgen, < 14 frokost, < 17 snack, ellers aften). Én fælles helper i
   `core/utils/meal-slot.ts` bruges af mad, samlinger, historik og hjem. Midlertidig (gap).
3. **Login med e-mail** (API'et kan ikke andet). Signup: register → "indsæt koden fra mailen" →
   verify → auto-login med adgangskoden i hukommelsen.
4. **Glemt adgangskode:** tokenet indsættes i kodefeltet (ingen verify-code-endpoint); reset
   validerer.
5. **Samlinger:** ikon og måltid gemmes lokalt pr. `mealCollectionId` (gap). Logning af en samling
   bruger `POST …/{id}/log` (én log pr. vare). Mindst én vare kræves.
6. **Påmindelser:** indstillinger gemmes i API'et, leveres stadig som lokale notifikationer.
   Ingen Firebase/devices. Id-rækkefølge-konvention for de fire `LogFood`-slags; ugedag lokal.
7. **Præstationer:** `TenMeals` fra API'et; resten afledes lokalt af API-data; scanninger lokalt.
8. **Historik:** bygges af food-logs + weight-logs (+ goals, deduplikeret), ikke `/me/history`.
9. **Profilbillede:** implementeres (multipart `file`, canvas-beskæring bagt ind), men **uploades
   ikke under test** – dev-API'et skriver til den rigtige Azure-container.
10. Gamle lokale data migreres ikke. Ubrugte `STORAGE_KEY`s fjernes (og ryddes én gang).
