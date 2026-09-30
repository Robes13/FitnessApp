# Session data

`SessionDataService` binder de stores, der henter brugerens data fra API'et, til sessionen:

| `SessionService.status()` bliver | Sker der                                                       |
| -------------------------------- | -------------------------------------------------------------- |
| `authenticated`                  | `load()` på hver store i `SESSION_DATA_STORES` (abonneres her) |
| `guest`                          | `reset()` på hver store                                        |
| `pending-verification`           | Intet – der er ingen tokens, så `/me/**` ville give 401        |

Det sker også ved opstart med en genskabt session. Skifter status igen, mens en `load()` kører,
afbrydes den. Servicen oprettes af en app initializer i `app.config.ts`.

## Tilføj en store

1. Lad storen implementere `SessionDataStore`:
   - `load(): Observable<unknown>` henter brugerens data. Storen håndterer selv sine fejl (fx et
     `status`-signal `'idle' | 'loading' | 'ready' | 'error'`), så observablen fejler ikke.
   - `reset(): void` glemmer dataene igen – **kun i hukommelsen, aldrig i storage**. Log ud
     bevarer enhedens data, og efter en kontosletning er storage lige blevet ryddet. Lokale
     data, som API'et ikke kan gemme (gaps), læses derfor i `load()`, ikke i konstruktøren.
     Logger en _anden_ konto ind, rydder `SessionService` den forriges nøgler i storage, før
     `load()` kaldes (tema og sprog bevares, `DEVICE_STORAGE_KEYS`).
2. Tilføj den i fabrikken i `session-data.ts`:

   ```ts
   factory: () => [inject(WeightLogService), inject(FoodLogService)],
   ```

Stores henter **aldrig** selv ved konstruktion – kun når `load()` kaldes herfra (eller efter
en brugerhandling).

## Test

`SESSION_DATA_STORES` er et `InjectionToken`, så en spec giver sine egne stores:
`{ provide: SESSION_DATA_STORES, useValue: [fakeStore] }`, derefter
`TestBed.inject(SessionDataService)` og `TestBed.tick()`, så effekten kører.
