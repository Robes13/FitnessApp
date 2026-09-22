# Historik – modeller

Typer, der kun bruges af historikken.

| Type               | Indhold                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `HistoryKind`      | `vejning` · `mad` · `maal` – bestemmer prikkens farve og hvilket filter posten rammer.  |
| `HistoryFilterId`  | `alle` plus de tre posttyper.                                                           |
| `HistoryValueTone` | Farven på tallet til højre: `default` · `positive` · `negative`.                        |
| `HistoryEntry`     | Én linje. `food` + `meal` er kun sat på måltider, der kan logges igen.                  |
| `HistoryGroup`     | Posterne for én dag under etiketten `I dag · 21. sep` + `foodSummary` (dagens totaler). |
| `HistoryFilter`    | Id og etiket til en filter-chip.                                                        |

`HistoryEntry` bærer både den formaterede tekst (`value`, `when`, `whenDate`) og den rå
`date`. Teksterne bygges i `services/history.ts`, så templaten ikke indeholder logik, mens
`date` bruges til sortering og gruppering.
