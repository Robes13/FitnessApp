# Testing

Hjælpere til unit tests. Ingen af filerne bruges i produktion (de indeholder kun rene
funktioner og providers, så de kan kompileres sammen med appen uden vitest-afhængigheder).

| Fil                        | Indhold                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fake-document.ts`         | `createFakeDocument()` / `createFakeStorage()` – et minimalt `DOCUMENT` med `documentElement`-attributter og en `localStorage` i hukommelsen (med `length`/`key()`, så `clearAll()` kan gennemløbe den).                                                                                                                                                                                                                                                          |
| `test-providers.ts`        | `provideCoreTestEnvironment()` (service-specs), `provideComponentTestEnvironment()` + `resetComponentTestStorage()` (komponent-specs) og `TEST_NOW`.                                                                                                                                                                                                                                                                                                              |
| `fixtures.ts`              | Testdata, appen ikke selv leverer: `weighHistory()` / `weightLogDto()` + `flushTestWeighIns()` (vejningerne via `load()`), `TEST_FOOD` til en vare, der kan logges, `testFood()` / `testFoodLog()` (API'ets `FoodDto`/`FoodLogDto`) og `flushTestFoodLog()` (madloggens `load()` besvaret), sessionerne `AUTHENTICATED_SESSION` / `PENDING_SESSION` + `TEST_AUTH_RESPONSE` / `TEST_EMAIL` og `TEST_GOAL` + `flushTestGoal()` (profilens mål og dermed `targets`). |
| `global-test-providers.ts` | Providers, alle specs får (`providersFile` i `angular.json`): ngx-translate med dansk og `HttpClient` på Angulars testing-backend.                                                                                                                                                                                                                                                                                                                                |

Samlinger: `testCollection()` (API'ets `MealCollectionDto`) og `flushTestCollections()`
(samlingernes `load()` besvaret) i `fixtures.ts`.

`TEST_NOW` er mandag 21. september 2026 kl. 10:30. Begge miljøer fryser `NOW`.

## HTTP

Ingen spec når netværket: `global-test-providers.ts` giver alle specs `provideHttpClient()` +
`provideHttpClientTesting()`. En spec besvarer kaldene selv:

```ts
const http = TestBed.inject(HttpTestingController);
const done = firstValueFrom(service.load());
http.expectOne({ method: 'GET', url: '/api/v1/me/weight-logs?limit=100' }).flush(page);
await done;
http.verify(); // typisk i afterEach
```

URL'en er `API_BASE_URL` i browseren (`/api/v1`) + endpointet. Fejl: `flush(body, { status: 409,
statusText: 'Conflict' })`, tom 401: `flush(null, { status: 401, statusText: 'Unauthorized' })`,
netværk: `.error(new ProgressEvent('error'))`.

En spec, der skal have auth-interceptoren med (Bearer, fornyelse), tilføjer
`provideHttpClient(withInterceptors([authInterceptor]))` og `provideHttpClientTesting()` i sine
egne providers. Importér ikke app-kode i `global-test-providers.ts` – det bryder test-buildet.

En logget ind bruger seedes med `AUTHENTICATED_SESSION` (tokens gyldige til 2099):
`createFakeStorage({ [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION })` eller
`resetComponentTestStorage({ [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION })`. `PENDING_SESSION`
er det, `register` gemmer for en ubekræftet konto – genskabt efter en genstart er den en gæst, så en
spec, der skal bruge ventetilstanden, laver den med et login, der får 403. `SIGNED_OUT_SESSION` er
samme konto efter log ud (e-mail og `userId` huskes). Den gamle form `{ isLoggedIn, isEmailVerified }` genskabes som gæst.

Specs, der laver HTTP-kald, afslutter med `TestBed.inject(HttpTestingController).verify()` i
`afterEach`, så et ekstra kald (fx et gensend, der ugyldiggør den første kode) får testen til at
fejle.

## Service-specs

`provideCoreTestEnvironment({ now?, storage? })` erstatter `DOCUMENT` med `createFakeDocument()`,
så testen hverken rører den rigtige DOM eller browserens storage.

```ts
const storage = createFakeStorage();
TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
const service = TestBed.inject(ThemeService);
```

Seed storage før `TestBed.inject`, hvis en test skal ramme "genskab fra storage"-stien.

Appen seeder ikke selv noget: alle stores starter tomme. Vejninger kommer fra API'et, så en test
giver dem med `flushTestWeighIns(weighHistory(TEST_NOW))` (efter `configureTestingModule`).

## Madloggen i specs

Madloggen ligger kun i hukommelsen (den hentes fra API'et). Loggede måltider lægges ind med
`TestBed.inject(FoodLogService).addLogs([testFoodLog(TEST_FOOD, 'aften')])` (valgfrit tidspunkt
og `foodId`); brugerens katalog – det søgningen finder – med `flushTestFoodLog(foods, logs)`,
der besvarer `load()` med `testFood({ foodId, name, … })`-varer. Mutationer (`add`, `remove` …)
besvares med `HttpTestingController` som alle andre kald.

## Profilen i specs

Profilen ligger kun i hukommelsen (den hentes fra API'et), så en spec seeder den aldrig i storage.
Profilfelter sættes med `TestBed.inject(UserProfileService).update({ … })`, og kalorie-/makromålet
(`targets`) med `flushTestGoal()` – `reloadGoal()` besvaret med `TEST_GOAL` (2500 kcal, 188/250/83 g)
eller et andet `UserGoalDto`. Det kræver `HttpTestingController`, som alle specs har.

## Komponent-specs

Det falske dokument har ingen `querySelector`, så `TestBed.createComponent()` fejler med det.
Komponent-specs bruger derfor `provideComponentTestEnvironment({ now? })`, som beholder jsdom's
rigtige `DOCUMENT` og kun leverer den deterministiske del.

Browserens `localStorage` deles mellem tests, så spec'en nulstiller den selv:

```ts
beforeEach(() => {
  resetComponentTestStorage({ [STORAGE_KEY.SESSION]: AUTHENTICATED_SESSION });
});

TestBed.configureTestingModule({
  providers: [...provideComponentTestEnvironment(), provideRouter(routes)],
});
```

`resetComponentTestStorage()` er bevidst adskilt fra providerne: en test, der seeder storage
efter at have konfigureret `TestBed`, ville ellers få sit seed ryddet.
