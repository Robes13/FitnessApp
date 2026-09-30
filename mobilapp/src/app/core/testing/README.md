# Testing

Hjælpere til unit tests. Ingen af filerne bruges i produktion (de indeholder kun rene
funktioner og providers, så de kan kompileres sammen med appen uden vitest-afhængigheder).

| Fil                        | Indhold                                                                                                                                                                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fake-document.ts`         | `createFakeDocument()` / `createFakeStorage()` – et minimalt `DOCUMENT` med `documentElement`-attributter og en `localStorage` i hukommelsen (med `length`/`key()`, så `clearAll()` kan gennemløbe den).                                                                                                             |
| `test-providers.ts`        | `provideCoreTestEnvironment()` (service-specs), `provideComponentTestEnvironment()` + `resetComponentTestStorage()` (komponent-specs) og `TEST_NOW`.                                                                                                                                                                 |
| `fixtures.ts`              | Testdata, appen ikke selv leverer: `weighEntry()` / `weighHistory()` til en vejningshistorik, `TEST_FOOD` til en vare, der kan logges, sessionerne `AUTHENTICATED_SESSION` / `PENDING_SESSION` + `TEST_AUTH_RESPONSE` / `TEST_EMAIL` og `TEST_GOAL` + `flushTestGoal()` (giver profilen et mål og dermed `targets`). |
| `global-test-providers.ts` | Providers, alle specs får (`providersFile` i `angular.json`): ngx-translate med dansk og `HttpClient` på Angulars testing-backend.                                                                                                                                                                                   |

`TEST_NOW` er mandag 21. september 2026 kl. 10:30. Begge miljøer fryser `NOW` og sætter den
kunstige forsinkelse (`FOOD_SEARCH_DELAY_MS`) til 0 ms.

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
er en oprettet, ubekræftet konto, og `SIGNED_OUT_SESSION` er samme konto efter log ud (e-mail og
`userId` huskes). Den gamle form `{ isLoggedIn, isEmailVerified }` genskabes som gæst.

Specs, der laver HTTP-kald, afslutter med `TestBed.inject(HttpTestingController).verify()` i
`afterEach`, så et ekstra kald (fx et gensend, der ugyldiggør den første kode) får testen til at
fejle.

## Service-specs

`provideCoreTestEnvironment({ now?, storage? })` erstatter `DOCUMENT` med `createFakeDocument()`,
så testen hverken rører den rigtige DOM eller browserens storage.

```ts
const storage = createFakeStorage();
TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
const service = TestBed.inject(FoodLogService);
```

Seed storage før `TestBed.inject`, hvis en test skal ramme "genskab fra storage"-stien.

Appen seeder ikke selv noget: alle stores starter tomme. En test, der har brug for en
vejningshistorik eller et logget måltid, lægger det selv i storage – `fixtures.ts` har
byggestenene.

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
