# Vægt – services

| Fil                | Indhold                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `weight-view.ts`   | `WeightViewService` – skærmens afledte værdier og de to handlinger på den. |
| `weight-view.spec` | Dækker kladde, toner, graf, liste (3 mdr., fold ud), gem, ret og slet.     |

## `WeightViewService`

Servicen er **ikke** `providedIn: 'root'`. `WeightPage` udstiller den selv
(`providers: [WeightViewService]`), så kladdevægten og det valgte interval lever lige så længe
som skærmen. Persistent tilstand ligger i `WeightLogService` og `UserProfileService`.

| Gruppe     | Signals                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Kladde     | `draftKg`, `draftText`, `draftIsWide` (fra 100 kg skifter tallet til et mindre trin)                                              |
| Forskel    | `deltaKg`, `deltaText`, `deltaTone`, `progressKg` (designets `good`)                                                              |
| Mål        | `goalWeightKg`, `goalWeightText`, `toGoalKg`, `toGoalText`                                                                        |
| Graf       | `range`, `rangeOptions`, `rangeLabel`, `rangeStartLabel`, `seriesKg`, `rangeDeltaText/-Tone`                                      |
| Liste      | `allLogRows`, `logRows`, `logExpanded`, `hiddenLogCount`, `logEmptyMessage`, `hasEntries`, `lastWeighLabel`                       |
| Ret-ark    | `editingRow`                                                                                                                      |
| Handlinger | `setDraftKg`, `adjustDraftKg`, `selectRange`, `save`, `toggleLogExpanded`, `startEdit`, `saveEdit`, `removeEditing`, `cancelEdit` |

`weightChangeTone(deltaKg, goal)` er eksporteret som ren funktion: "tage på" belønner en
stigning, "holde vægten" belønner en bevægelse under ±0,5 kg, alt andet belønner et fald.
Forskelle under 0,05 kg er neutrale (dæmpede).

`allLogRows` er alle vejninger fra de sidste 3 mdr. (`WEIGHT_LOG_HISTORY_RANGE`); `logRows` er de
`COLLAPSED_LOG_ROWS` (6) nyeste, indtil listen foldes ud. Den ældste viste række sammenlignes
stadig med vejningen før den, så "Start" kun står ved brugerens allerførste vejning.
`logEmptyMessage` skelner mellem "aldrig vejet" og "ingen vejninger de sidste 3 mdr.".

Hvilken vejning der rettes (`editingRow`), ejes af servicen; selve kladden i arket ejes af
`WeightEditSheet`. `save()` på en dag med en vejning erstatter dagens vejning.

`goalWeightKg` følger designet: målet "holde vægten" sigter mod den nuværende vægt, ellers
bruges profilens målvægt klemt fast mellem 30 og 300 kg.
