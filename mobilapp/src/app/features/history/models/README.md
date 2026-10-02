# Historik – modeller

Typer, der kun bruges af historikken.

| Type               | Indhold                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `HistoryEventType` | API'ets hændelsestyper (`AccountCreated` · `GoalUpdated` · `FoodLogged` · …).                   |
| `HistoryEventDto`  | Én hændelse fra `GET me/history` med payload (`foodLog` / `weightLog` / `goal`, ellers `null`). |
| `HistoryKind`      | `vejning` · `mad` · `maal` · `konto` – bestemmer prikkens farve.                                |
| `HistoryFilterId`  | `alle` plus `vejning` · `mad` · `maal`.                                                         |
| `HistoryEntry`     | Én linje. `food` + `meal` er kun sat på måltider, der kan logges igen.                          |
| `HistoryGroup`     | Posterne for én dag under etiketten `I dag · 21. sep` + `foodSummary` (dagens totaler).         |
| `HistoryFilter`    | Id, etiket og `types` (API'ets `types`-query) til en filter-chip.                               |

Payload-typerne genbruges fra `core/models` (`FoodLogDto`, `WeightLogDto`, `UserGoalDto`).
`HistoryEntry` bærer både den formaterede tekst (`value`, `when`, `whenDate`) og den rå
`date`. Teksterne bygges i `services/history.ts`, så templaten ikke indeholder logik, mens
`date` bruges til gruppering.
