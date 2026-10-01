# Historik – services

| Fil          | Indhold                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `history.ts` | `HistoryService` samt `HISTORY_ENDPOINT`, `HISTORY_PAGE_SIZE`, `HISTORY_FILTERS`, gen-log-nøglerne og -varigheden. |

## HistoryService

`@Injectable()` **uden** `providedIn` – `HistoryPage` leverer den selv, så siderne, filteret og
gen-log-status nulstilles, når man forlader fanen.

| Medlem                                      | Formål                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `events` / `nextCursor` / `hasMore`         | De indlæste hændelser (API'ets rækkefølge) og cursoren til næste side.                                                                           |
| `status`                                    | `idle` → `loading` → `ready` / `error` for den seneste side.                                                                                     |
| `loadMore()`                                | `GET me/history?types&limit=50[&cursor]` + `mapApiError()`, lægges efter de hentede. No-op under indlæsning, efter sidste side og efter en fejl. |
| `retry()`                                   | Henter den fejlede side igen.                                                                                                                    |
| `filters` / `filter` / `setFilter()`        | Alle · Vejning · Mad · Mål. Et skift dropper en side på vej, nulstiller og henter første side med filterets `types`.                             |
| `entries`                                   | Hændelserne som linjer, uden registreringens mål (samme `occurredAt` som en indlæst `AccountCreated`).                                           |
| `groups`                                    | `entries` pr. lokal dag med `foodSummary` – `null` uden måltider og på den sidste dag, mens der er flere sider.                                  |
| `isEmpty`                                   | Hentet, men intet at vise.                                                                                                                       |
| `relog()` / `relogState()` / `relogLabel()` | Gen-log via `FoodLogService.add(...)`: `pending` mens API'et gemmer (tryk ignoreres), så `logged` / `failed` i 2,6 sekunder.                     |

Afhængigheder: `HttpClient` + `injectApiUrl()`, `FoodLogService` (gen-log), `NOW` (så tests kan
fastfryse tiden). Mapningen genbruger `toLoggedFood`, `GOAL_FROM_API` + `GOALS` og
`parseApiDateTime`.

Posttyperne og den skjulte registrering står i featurens [`README.md`](../README.md).
