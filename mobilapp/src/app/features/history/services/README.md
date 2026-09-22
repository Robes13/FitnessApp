# Historik – services

| Fil                    | Indhold                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `history.ts`           | `HistoryService` samt `HISTORY_FILTERS`, `RELOG_LABEL`, `RELOGGED_LABEL`, `RELOGGED_DURATION_MS`. |
| `history-demo-data.ts` | Designets syntetiske måltider, målændringer og dagsopsamlinger.                                   |

## HistoryService

`@Injectable()` **uden** `providedIn` – `HistoryPage` leverer den selv, så filteret og
"Logget i dag"-status nulstilles, når man forlader fanen.

| Medlem                                      | Formål                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `filters`                                   | Designets `histFilters`: Alle · Vejning · Mad · Mål.                   |
| `filter` / `setFilter()`                    | Det valgte filter.                                                     |
| `entries`                                   | Alle poster, flettet og sorteret faldende på dato.                     |
| `visibleEntries`                            | `entries` filtreret på posttype.                                       |
| `groups`                                    | `visibleEntries` grupperet pr. dag (`I dag · 21. sep`).                |
| `isEmpty`                                   | Sandt, når filteret ikke rammer nogen poster.                          |
| `relog()` / `isRelogged()` / `relogLabel()` | Gen-log via `FoodLogService.add` og etiketten i 2,6 sekunder bagefter. |

Afhængigheder: `WeightLogService` (rigtige vejninger), `UserProfileService` (kaloriemål,
målvægt, højde, tempo), `FoodLogService` (gen-log) og `NOW` (så tests kan fastfryse tiden).

Flettningens rækkefølge og valget om at sortere på dato frem for klokkeslæt er forklaret i
featurens [`README.md`](../README.md).
