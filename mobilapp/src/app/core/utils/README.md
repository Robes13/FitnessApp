# Utils

Rene, sideeffektfrie hjælpefunktioner.

## `date-format.ts`

Dato- og talformatering som i designet (eksemplerne er på dansk). Funktionerne, der giver
tekst, tager en `t: Translate` fra `injectTranslate()` som første parameter:

| Funktion                                            | Eksempel                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------- |
| `formatRelativeDay(t, date, today)`                 | `'I dag'` · `'I går'` · `'3 dage siden'`                                  |
| `formatDayLabel(t, date)`                           | `'Mandag 21. sep'`                                                        |
| `formatDayMonth(t, date)`                           | `'21. sep'`                                                               |
| `formatWeekdayAbbreviated(t, date)`                 | `'Tir.'`                                                                  |
| `formatTime(date)`                                  | `'07:45'`                                                                 |
| `formatDecimal(74.5)`                               | `'74,5'`                                                                  |
| `formatWeightKg(74.5)` / `formatWeightKg(75)`       | `'74,5'` · `'75'` (designets `weightText`)                                |
| `formatSignedDecimal(-1.2)`                         | `'−1,2'` (typografisk minus)                                              |
| `formatInteger(6000)`                               | `'6.000'`                                                                 |
| `mondayIndex(date)`                                 | `0` = mandag … `6` = søndag                                               |
| `toIsoDate(date)`                                   | `'2026-09-21'` (lokal tid)                                                |
| `fromIsoDate('2026-09-21')`                         | lokal midnat den dag (omvendt `toIsoDate`)                                |
| `startOfDay`, `addDays`, `isSameDay`, `daysBetween` | dato-aritmetik på kalenderdage                                            |
| `currentTimeZoneId()`                               | `'Europe/Copenhagen'` (IANA, `'UTC'` som fallback) – API'ets `timeZoneId` |

Navnelister (oversættelsesnøgler, mandag/januar først): `DAY_NAME_SHORT_KEYS`,
`DAY_NAME_LONG_KEYS`, `DAY_LETTER_KEYS`, `MONTH_NAME_LONG_KEYS`, `MONTH_NAME_SHORT_KEYS`.

Talformateringen er `Number.prototype.toLocaleString(…)` — ikke håndlavede separatorer. Locale
følger appens sprog via signalet `numberLocale`, som `LanguageService` sætter med
`setNumberLocale()` (`'74,5'` på dansk, `'74.5'` på engelsk), så en `computed()`, der formaterer et
tal, genberegnes ved sprogskift. Kun det typografiske minus i `formatSignedDecimal` sættes
bagefter, fordi `Intl` bruger en almindelig bindestreg. Eksemplerne ovenfor er på dansk.

## `api.ts`

Det fælles HTTP-lag for alle domæner:

| Funktion                      | Brug                                                                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `injectApiUrl()`              | `const url = injectApiUrl();` → `url('me/weight-logs')` = `'/api/v1/me/weight-logs'` (base-URL fra `API_BASE_URL`).                                            |
| `toApiError(error, resolve?)` | Enhver fejl → `ApiError { messageKey, status? }`. Læser API'ets tre fejlformer, tom body og status 0. `resolve(problem)` giver en specifik nøgle eller `null`. |
| `mapApiError(resolve?)`       | `catchError`, der kaster `toApiError(...)` videre – sidste led i en services HTTP-pipe.                                                                        |
| `fetchAllPages(fetchPage)`    | Følger `nextCursor`, til `hasMore` er `false`, og giver alle `items` i API'ets rækkefølge (nyeste først). `fetchPage(null)` er første side.                    |
| `parseApiDateTime(value)`     | Et API-tidsstempel (UTC med `Z`, 0–7 decimaler) som `Date`; decimalerne kortes til 3, så også ældre WebViews kan læse det.                                     |
| `readProblemBody(error)`      | Fejlens body som record – også når CapacitorHttp (Android) giver den som tekst (JSON parses i `try/catch`); tom, ikke-JSON eller `null` → `{}`.                |

`ApiProblem` er det, en resolver får: `{ status, detail, fields }` – `detail` er API'ets engelske
tekst (matches med et regex), `fields` er nøglerne i en valideringsfejl med små bogstaver og
uden `$.` (`'password'`, `'birthdate'`). Uden resolver (eller når den giver `null`) bruges de
generelle nøgler i `API_ERROR_MESSAGE_KEY`: status 0 → netværk, 5xx → server, resten →
"Noget gik galt. Prøv igen."

Eksempel fra en domæne-service (navnene er illustrative; `HttpStatusCode` kommer fra
`@angular/common/http` – ingen magiske statuskoder):

```ts
return this.http
  .post<WeightLogDto>(this.url(WEIGHT_ENDPOINT.LOGS), request)
  .pipe(
    mapApiError((problem) =>
      problem.status === HttpStatusCode.Conflict ? WEIGHT_ERROR_KEY.DAY_TAKEN : null,
    ),
  );
```

Skal en service bruge et felt ud over `detail`/`errors` (fx vægt-409'ens `existingWeightLogId`),
læser den bodyen med `readProblemBody`, så streng-bodies fra CapacitorHttp også virker:

```ts
catchError((error: unknown) => {
  if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.Conflict) {
    const id = readProblemBody(error)['existingWeightLogId'];
    if (typeof id === 'number') {
      return of({ kind: 'exists', id: String(id) });
    }
  }
  return throwError(() => toApiError(error));
});
```

API'et sender ingen fejlkoder (plan-v2 P6); statuskoden, felterne og – for de to 409'ere med
samme status – `detail`-teksten er det, der skelnes på.

En fejl, der ikke er en `HttpErrorResponse` (en bug, fx i en mapping), bliver den generiske
nøgle og logges med `console.error`, så den ikke forsvinder.

## `language.ts`

`isLanguage(value)` – type guard for `Language`, bruges på gemte værdier og i oversættelses-loaderen.

## `clock-time.ts`

`formatClockTime({ hour: 7, minute: 5 })` → `'07:05'` og `parseClockTime('07:05')` → `ClockTime`
(eller `null`) – formatet i `<input type="time">`. `isClockTime` validerer gemte tider.

## `math.ts`

`clamp(value, min, max)` klemmer et tal fast til intervallet `[min, max]`.
`roundTo(value, decimals)` runder til et antal decimaler og normaliserer `-0` til `0`, så
afrundede værdier kan sammenlignes strengt.

Begge bruges overalt, hvor der ellers ville stå `Math.min(max, Math.max(min, x))` eller
`Math.round(x * 10) / 10` lokalt — geometri-modulerne, opret-flowets trin, Vægt, Hjem og
`NutritionCalculator`.

## `name.ts`

`normalizeName(name)` trimmer og laver små bogstaver med dansk locale
(`toLocaleLowerCase('da')`). Bruges til dubletkontrol af navne på samlinger
(`CollectionsService`) og egne varer (`FoodLogService`).

## `id.ts`

`newId(prefix)` giver `<prefix>-<uuid>` via `crypto.randomUUID()`. Præfikset gør posten
genkendelig i storage og fejlsøgning; unikheden kommer fra platformen.

## `now.ts`

`NOW` er et `InjectionToken<() => Date>`. Injicér det i stedet for at kalde `new Date()`, så
tests kan fastfryse tiden: `{ provide: NOW, useValue: () => new Date(2026, 8, 21) }`.
