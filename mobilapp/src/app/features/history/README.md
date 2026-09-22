# Historik

Fanen **Historik** (`/historik`): én liste over dagens og de seneste dages poster, filtreret
med chips (Alle · Vejning · Mad · Mål) og grupperet pr. dag. Skærmen er designets
`tabHistorik` (HTML-linje 1066–1096) og logikken bag `historyGroups` / `histFilters` / `relog`.

| Fil                             | Indhold                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `history.routes.ts`             | `HISTORY_ROUTES` – én rute (`''`) med `HistoryPage`.                                         |
| `models/history.ts`             | `HistoryEntry`, `HistoryGroup`, `HistoryFilter` og de tre posttyper.                         |
| `services/history.ts`           | `HistoryService` – bygger, filtrerer og grupperer posterne; holder filter og gen-log-status. |
| `services/history-demo-data.ts` | Designets syntetiske måltider, målændringer og dagsopsamlinger.                              |
| `pages/history-page/`           | Skærmen.                                                                                     |

## Data: hvad er rigtigt, og hvad er demo

Kun **vejninger** er rigtige data – de kommer fra `WeightLogService`, så en ny vejning på
Vægt-fanen dukker op i historikken med det samme. Resten er prototypens demo-indhold:

| Type                  | Kilde                                       | Bemærkning                                             |
| --------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Vejning               | `WeightLogService.entries()`                | Nyeste får underteksten `Morgen, før morgenmad`.       |
| Dagsopsamling (`mad`) | `DEMO_DAY_SUMMARIES` + `UserProfileService` | `Dagsmål nået` / `Over dagsmål` mod dagens kaloriemål. |
| Måltid (`mad`)        | `DEMO_HISTORY_MEALS`                        | Har `food` + `meal` og kan derfor logges igen.         |
| Mål (`maal`)          | `DEMO_GOAL_CHANGES` + profilens tal         | Kaloriemål, målvægt, højde og tempo.                   |

Demo-dataene ligger i featuren – ikke i `core/constants/demo-data.ts` – fordi de kun bruges
her og ikke er en del af appens delte tilstand.

## Rækkefølge og gruppering

Prototypen fletter posterne i en fast rækkefølge:

```
histAll[0..2) → histMeals[0..2) → histMaal[0..1) → histAll[2..] → histMeals[2..] → histMaal[1..]
```

hvor `histAll` skifter mellem vejning og dagsopsamling. `HistoryService.buildEntries()` gør
det samme og sorterer derefter **faldende på dato – ikke på klokkeslæt**. Sorteringen i
JavaScript er stabil, så rækkefølgen inden for en dag følger flettningen, præcis som i
prototypen (hvor alle poster lå kl. 12). Ville vi sortere på tidspunkt, ville en rigtig
vejning kl. 10.30 hoppe om bag demo-posterne fra samme dag.

Grupperne får designets etiket `I dag · 21. sep` / `I går · 20. sep` / `Tir. · 19. sep`
(`formatWeekdayAbbreviated` + `formatDayMonth` fra `core/utils/date-format.ts`).

## Beslutninger

- **Servicen leveres af siden**, ikke `providedIn: 'root'`. Både filteret og
  "Logget i dag"-status hører til skærmen og skal nulstilles, når man forlader fanen.
  `DestroyRef.onDestroy()` rydder 2,6-sekunders-timeren.
- **Gen-log** (`redo`-ikonet) kalder `FoodLogService.add(food, meal)`. Som i designet skifter
  knappen kun farve til grøn, mens teksten `Logget i dag` står i `aria-label` og `title` –
  der er ingen synlig etiket ved siden af ikonet.
- **Tal formateres dansk** med `formatInteger` / `formatDecimal` (`1.970 af 2.010 kcal`,
  `75,0 kg`). Prototypen skrev rå tal her, men brugte dansk formatering på de andre skærme.
- **Ingen loading- eller fejltilstand.** Skærmen læser kun signals fra `core/` – der er
  ingen asynkrone kald. Tom tilstand er `UiEmptyState('Ingen poster endnu.')`, som kun kan
  opstå, hvis et filter ikke rammer noget.
- Prototypens `histHeading` (`Seneste` / `Vejninger` / `Mad` / `Mål og indstillinger`) er
  beregnet i logikken, men **tegnes ikke** i designets template. Den er derfor udeladt.
