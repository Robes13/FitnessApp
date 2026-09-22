# Utils

Rene, sideeffektfrie hjælpefunktioner.

## `date-format.ts`

Dansk dato- og talformatering som i designet:

| Funktion                                            | Eksempel                                   |
| --------------------------------------------------- | ------------------------------------------ |
| `formatRelativeDay(date, today)`                    | `'I dag'` · `'I går'` · `'3 dage siden'`   |
| `formatDayLabel(date)`                              | `'Mandag 21. sep'`                         |
| `formatDayMonth(date)`                              | `'21. sep'`                                |
| `formatWeekdayAbbreviated(date)`                    | `'Tir.'`                                   |
| `formatLongDate(date)`                              | `'16. maj 1998'`                           |
| `formatTime(date)`                                  | `'07:45'`                                  |
| `formatDecimal(74.5)`                               | `'74,5'`                                   |
| `formatWeightKg(74.5)` / `formatWeightKg(75)`       | `'74,5'` · `'75'` (designets `weightText`) |
| `formatSignedDecimal(-1.2)`                         | `'−1,2'` (typografisk minus)               |
| `formatInteger(6000)`                               | `'6.000'`                                  |
| `mondayIndex(date)`                                 | `0` = mandag … `6` = søndag                |
| `toIsoDate(date)`                                   | `'2026-09-21'` (lokal tid)                 |
| `startOfDay`, `addDays`, `isSameDay`, `daysBetween` | dato-aritmetik på kalenderdage             |

Navnelister: `DAY_NAMES_SHORT`, `DAY_NAMES_LONG`, `DAY_LETTERS`, `MONTH_NAMES_LONG`,
`MONTH_NAMES_SHORT`.

## `math.ts`

`clamp(value, min, max)` klemmer et tal fast til intervallet `[min, max]`. Brugt af
`NutritionCalculator`, Hjem, Historik, Vægt og opret-flowets skridt-, længde- og
intensitetstrin, så den samme afgrænsning ikke skrives lokalt i hver fil.

## `now.ts`

`NOW` er et `InjectionToken<() => Date>`. Injicér det i stedet for at kalde `new Date()`, så
tests kan fastfryse tiden: `{ provide: NOW, useValue: () => new Date(2026, 8, 21) }`.
