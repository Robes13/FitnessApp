# Historik

Fanen **Historik** (`/historik`): én liste over dagens og de seneste dages poster, filtreret
med chips (Alle · Vejning · Mad · Mål) og grupperet pr. dag. Skærmen er designets
`tabHistorik` (HTML-linje 1066–1096) og logikken bag `historyGroups` / `histFilters` / `relog`.

| Fil                   | Indhold                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `history.routes.ts`   | `HISTORY_ROUTES` – én rute (`''`) med `HistoryPage`.                                         |
| `models/history.ts`   | `HistoryEntry`, `HistoryGroup`, `HistoryFilter` og de tre posttyper.                         |
| `services/history.ts` | `HistoryService` – bygger, filtrerer og grupperer posterne; holder filter og gen-log-status. |
| `pages/history-page/` | Skærmen.                                                                                     |

## Data

Alle poster er brugerens egne:

| Type           | Kilde                         | Bemærkning                                                                                  |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| Vejning        | `WeightLogService.entries()`  | Nyeste får underteksten `Seneste vejning`.                                                  |
| Måltid (`mad`) | `FoodLogService.allEntries()` | Dagens og tidligere dages måltider (90 dage). Har `food` + `meal` og kan logges igen i dag. |
| Mål (`maal`)   | –                             | Målændringer registreres ikke endnu; filteret er altid tomt.                                |

Madloggen gemmer de seneste 90 dage, så listen viser tidligere logget mad sammen med
vejningerne. Hver dag med måltider får under etiketten dagens samlede kalorier og makroer
(`1.970 kcal · P 120 g · K 210 g · F 60 g`, `HistoryGroup.foodSummary`) – det dækker "se
tidligere logget kalorieindtag" og "se tidligere logget makronæringsstoffer". Opsummeringen
er hele dagens log, også når kun en del af posterne er synlige. Har brugeren intet
registreret, viser skærmen sin tomme tilstand.

`maal`-filteret bliver stående, fordi målændringer er et rigtigt domænebegreb, backenden
kommer til at levere – indtil da viser det den tomme tilstand.

## Rækkefølge og gruppering

`HistoryService.buildEntries()` lægger vejninger og måltider sammen og sorterer **faldende på
tidspunkt**.

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
