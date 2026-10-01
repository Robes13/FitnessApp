# Historik – services

| Fil          | Indhold                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------- |
| `history.ts` | `HistoryService` samt `HISTORY_FILTERS`, `RELOG_LABEL`, `RELOGGED_LABEL`, `RELOGGED_DURATION_MS`. |

## HistoryService

`@Injectable()` **uden** `providedIn` – `HistoryPage` leverer den selv, så filteret og
"Logget i dag"-status nulstilles, når man forlader fanen.

| Medlem                                      | Formål                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filters`                                   | Designets `histFilters`: Alle · Vejning · Mad · Mål.                                                                                                                                |
| `filter` / `setFilter()`                    | Det valgte filter.                                                                                                                                                                  |
| `entries`                                   | Alle poster, sorteret faldende på tidspunkt.                                                                                                                                        |
| `visibleEntries`                            | `entries` filtreret på posttype.                                                                                                                                                    |
| `groups`                                    | `visibleEntries` grupperet pr. dag (`I dag · 21. sep`) med `foodSummary` (dagens kcal og makroer, `null` uden måltider).                                                            |
| `isEmpty`                                   | Sandt, når filteret ikke rammer nogen poster.                                                                                                                                       |
| `relog()` / `isRelogged()` / `relogLabel()` | Gen-log via `FoodLogService.add(...)` (API'et) og etiketten i 2,6 sekunder, når API'et har gemt rækken. Fejler den, bliver knappen "Log igen i dag" (fejlvisning kommer i bølge 3). |

Afhængigheder: `WeightLogService` (vejningerne), `FoodLogService` (alle gemte dages måltider, dagstotaler og gen-log)
og `NOW` (så tests kan fastfryse tiden).

Hvilke posttyper der findes, og hvorfor `maal`-filteret er tomt, står i featurens
[`README.md`](../README.md).
