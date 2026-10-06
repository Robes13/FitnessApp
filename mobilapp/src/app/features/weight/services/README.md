# Vægt – services

| Fil                | Indhold                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `weight-view.ts`   | `WeightViewService` – skærmens afledte værdier og dens API-handlinger.                                                   |
| `weight-view.spec` | Kladde, toner, graf (3 uger), liste, gem/overskriv/annullér, ret og slet med fejl, startvægt, indlæsning og "Prøv igen". |

## `WeightViewService`

Servicen er **ikke** `providedIn: 'root'`. `WeightPage` udstiller den selv
(`providers: [WeightViewService]`), så kladdevægten og det valgte interval lever lige så længe
som skærmen. Persistent tilstand ligger i `WeightLogService` og `UserProfileService`.

| Gruppe     | Signals                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Kladde     | `draftKg`, `draftText`, `draftIsWide` (fra 100 kg skifter tallet til et mindre trin)                                |
| Forskel    | `deltaKg`, `deltaText`, `deltaTone`, `progressKg` (designets `good`)                                                |
| Mål        | `goalWeightKg`, `goalWeightText`, `toGoalKg`, `toGoalText`                                                          |
| Graf       | `range`, `rangeOptions`, `rangeLabel`, `rangeStartLabel`, `series`, `rangeDeltaText/-Tone`                          |
| Liste      | `allLogRows`, `logRows`, `logExpanded`, `hiddenLogCount`, `logEmptyMessage`, `hasEntries`, `lastWeighLabel`         |
| Indlæsning | `loadStatus` (`loading` hvis en af vægt- og profil-storen indlæser, ellers `error` hvis en fejlede, ellers `ready`) |
| Gem        | `saving`, `saveError`, `overwriteId` (overskrivningsarket er åbent), `overwriteError`                               |
| Ret-ark    | `editingRow`, `editBusy`, `editError`                                                                               |
| Handlinger | `setDraftKg`, `selectRange`, `toggleLogExpanded`, `startEdit`, `cancelEdit`, `cancelOverwrite`                      |
| API        | `save`, `confirmOverwrite`, `saveEdit`, `removeEditing`, `retryLoad` – alle `Observable<void>`                      |

`weightChangeTone(deltaKg, goal)` er eksporteret som ren funktion: "tage på" belønner en
stigning, "holde vægten" belønner en bevægelse under ±0,5 kg, alt andet belønner et fald.
Forskelle under 0,05 kg er neutrale (dæmpede).

`allLogRows` er alle vejninger fra de sidste 3 mdr. (`WEIGHT_LOG_HISTORY_RANGE`); `logRows` er de
`COLLAPSED_LOG_ROWS` (6) nyeste, indtil listen foldes ud. Den ældste viste række sammenlignes
stadig med vejningen før den, så "Start" kun står ved brugerens allerførste vejning.
`logEmptyMessage` skelner mellem "aldrig vejet" og "ingen vejninger de sidste 3 mdr.".

Hvilken vejning der rettes (`editingRow`), ejes af servicen; selve kladden i arket ejes af
`WeightEditSheet`.

**API-handlingerne** returnerer `Observable<void>`, som siden abonnerer på. De fejler aldrig: en
fejl sætter handlingens fejltekst (`saveError`, `overwriteError`, `editError`) og completer uden
værdi, så der kun emittes ved succes. Kører en handling allerede (`saving`/`editBusy`), gør et nyt
kald intet. `save()` emitter, når vejningen er gemt; har dagen allerede en vejning (409), sætter
den `overwriteId` og completer uden værdi – der overskrives først ved `confirmOverwrite()` (`PATCH`
med kladdens vægt og tiden nu). `cancelOverwrite()` sender intet. `saveEdit`/`removeEditing` lukker
arket ved succes og lader det stå åbent med `editError` (API-fejlens tekst) ved fejl. Har API'et
udført ændringen, og fejler kun synkroniseringen bagefter (vægten eller målet), lukker det åbne ark,
og API-fejlens tekst står i `saveError` – "ikke gemt" (`weight.page.saveError`) vises kun, når
intet blev gemt. `retryLoad()` genindlæser kun den eller de stores, der fejlede.

`goalWeightKg` følger designet: målet "holde vægten" sigter mod den nuværende vægt, ellers
bruges profilens målvægt klemt fast mellem 30 og 300 kg.
