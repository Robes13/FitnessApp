# Vægt – services

| Fil                | Indhold                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `weight-view.ts`   | `WeightViewService` – skærmens afledte værdier og de to handlinger på den. |
| `weight-view.spec` | Dækker kladde, toner, graf, liste og gem.                                  |

## `WeightViewService`

Servicen er **ikke** `providedIn: 'root'`. `WeightPage` udstiller den selv
(`providers: [WeightViewService]`), så kladdevægten og det valgte interval lever lige så længe
som skærmen. Persistent tilstand ligger i `WeightLogService` og `UserProfileService`.

| Gruppe     | Signals                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------- |
| Kladde     | `draftKg`, `draftText`, `draftIsWide` (fra 100 kg skifter tallet til et mindre trin)         |
| Forskel    | `deltaKg`, `deltaText`, `deltaTone`, `progressKg` (designets `good`)                         |
| Mål        | `goalWeightKg`, `goalWeightText`, `toGoalKg`, `toGoalText`                                   |
| Graf       | `range`, `rangeOptions`, `rangeLabel`, `rangeStartLabel`, `seriesKg`, `rangeDeltaText/-Tone` |
| Liste      | `logRows`, `hasEntries`, `lastWeighLabel`                                                    |
| Handlinger | `setDraftKg`, `adjustDraftKg`, `selectRange`, `save`                                         |

`weightChangeTone(deltaKg, goal)` er eksporteret som ren funktion: "tage på" belønner en
stigning, "holde vægten" belønner en bevægelse under ±0,5 kg, alt andet belønner et fald.
Forskelle under 0,05 kg er neutrale (dæmpede).

`goalWeightKg` følger designet: målet "holde vægten" sigter mod den nuværende vægt, ellers
bruges profilens målvægt klemt fast mellem 30 og 300 kg.
