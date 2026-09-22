# Testing

Hjælpere til unit tests. Ingen af filerne bruges i produktion (de indeholder kun rene
funktioner og providers, så de kan kompileres sammen med appen uden vitest-afhængigheder).

| Fil                 | Indhold                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fake-document.ts`  | `createFakeDocument()` / `createFakeStorage()` – et minimalt `DOCUMENT` med `documentElement`-attributter og en `localStorage` i hukommelsen.        |
| `test-providers.ts` | `provideCoreTestEnvironment()` (service-specs), `provideComponentTestEnvironment()` + `resetComponentTestStorage()` (komponent-specs) og `TEST_NOW`. |
| `fixtures.ts`       | Testdata, appen ikke selv leverer: `weighEntry()` / `weighHistory()` til en vejningshistorik og `TEST_FOOD` til en vare, der kan logges.             |

`TEST_NOW` er mandag 21. september 2026 kl. 10:30. Begge miljøer fryser `NOW` og sætter alle
kunstige forsinkelser (`FOOD_SEARCH_DELAY_MS`, `SCAN_DELAY_MS`) til 0 ms.

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

## Komponent-specs

Det falske dokument har ingen `querySelector`, så `TestBed.createComponent()` fejler med det.
Komponent-specs bruger derfor `provideComponentTestEnvironment({ now? })`, som beholder jsdom's
rigtige `DOCUMENT` og kun leverer den deterministiske del.

Browserens `localStorage` deles mellem tests, så spec'en nulstiller den selv:

```ts
beforeEach(() => {
  resetComponentTestStorage({ [STORAGE_KEY.PROFILE]: { ...DEFAULT_PROFILE } });
});

TestBed.configureTestingModule({
  providers: [...provideComponentTestEnvironment(), provideRouter(routes)],
});
```

`resetComponentTestStorage()` er bevidst adskilt fra providerne: en test, der seeder storage
efter at have konfigureret `TestBed`, ville ellers få sit seed ryddet.
