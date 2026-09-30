# Utils

Rene, sideeffektfrie hjælpefunktioner.

## `date-format.ts`

Dato- og talformatering som i designet (eksemplerne er på dansk). Funktionerne, der giver
tekst, tager en `t: Translate` fra `injectTranslate()` som første parameter:

| Funktion                                            | Eksempel                                   |
| --------------------------------------------------- | ------------------------------------------ |
| `formatRelativeDay(t, date, today)`                 | `'I dag'` · `'I går'` · `'3 dage siden'`   |
| `formatDayLabel(t, date)`                           | `'Mandag 21. sep'`                         |
| `formatDayMonth(t, date)`                           | `'21. sep'`                                |
| `formatWeekdayAbbreviated(t, date)`                 | `'Tir.'`                                   |
| `formatTime(date)`                                  | `'07:45'`                                  |
| `formatDecimal(74.5)`                               | `'74,5'`                                   |
| `formatWeightKg(74.5)` / `formatWeightKg(75)`       | `'74,5'` · `'75'` (designets `weightText`) |
| `formatSignedDecimal(-1.2)`                         | `'−1,2'` (typografisk minus)               |
| `formatInteger(6000)`                               | `'6.000'`                                  |
| `mondayIndex(date)`                                 | `0` = mandag … `6` = søndag                |
| `toIsoDate(date)`                                   | `'2026-09-21'` (lokal tid)                 |
| `fromIsoDate('2026-09-21')`                         | lokal midnat den dag (omvendt `toIsoDate`) |
| `startOfDay`, `addDays`, `isSameDay`, `daysBetween` | dato-aritmetik på kalenderdage             |

Navnelister (oversættelsesnøgler, mandag/januar først): `DAY_NAME_SHORT_KEYS`,
`DAY_NAME_LONG_KEYS`, `DAY_LETTER_KEYS`, `MONTH_NAME_LONG_KEYS`, `MONTH_NAME_SHORT_KEYS`.

Talformateringen er `Number.prototype.toLocaleString(…)` — ikke håndlavede separatorer. Locale
følger appens sprog via signalet `numberLocale`, som `LanguageService` sætter med
`setNumberLocale()` (`'74,5'` på dansk, `'74.5'` på engelsk), så en `computed()`, der formaterer et
tal, genberegnes ved sprogskift. Kun det typografiske minus i `formatSignedDecimal` sættes
bagefter, fordi `Intl` bruger en almindelig bindestreg. Eksemplerne ovenfor er på dansk.

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
