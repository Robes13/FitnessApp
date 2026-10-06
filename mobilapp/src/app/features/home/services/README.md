# Home – services

`HomeSummaryService` (`providedIn: 'root'`) beregner alt, Hjem viser, ud fra core-lagrene
(`UserProfileService` (også kalorie- og makromålet, `targets` fra API'et), `FoodLogService`,
`WeightLogService` og `NutritionCalculator`). Den laver ingen API-kald selv – kun "Prøv igen"
kalder storenes `load()`. Siden og kortene henter kun færdige værdier – ingen beregninger i
templates.

| Signal / metode                       | Indhold                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `selectedDay`                         | Dag i den rullende uge: 0 … `TODAY_INDEX` (6 = i dag); følger i dag |
| `todayLabel`                          | `Torsdag 24. sep`                                                   |
| `weekRings`                           | Syv ringe, i dag sidst: forkortelse, andel, farve, prik, markering  |
| `daySummary`                          | Den valgte dags titel, bjælke, kalorier, vægt og makroer            |
| `weekSummary`                         | Dage i mål, kcal i snit, protein ramt, streak og opsamlingen        |
| `todos`, `nextTodo`, `todoCountLabel` | Manglende vejning og måltider som "Næste skridt" (hentede stores)   |
| `showGoalCard`, `goalSummary`         | Målkortet (skjult, til målet er hentet, og ved målet `hold`)        |
| `goalReached`                         | Dagens kalorier har nået målet                                      |
| `ready`                               | Madlog og profil er hentet – fejringens udgangspunkt                |
| `celebrationDue`, `markCelebrated()`  | Målet er nået efter indlæsning og endnu ikke fejret af `HomePage`   |
| `loadFailed`, `reload()`              | En af de tre stores fejlede; `reload()` henter kun dem igen         |
| `dayRows`                             | De seneste `HOME_HISTORY_DAYS` (30) dage til arket, nyeste først    |
| `selectDay(index)`                    | Vælger dagen, ringene og dagskortet viser                           |

**Hvorfor `root`:** den valgte dag skal overleve et faneskift, præcis som i designet, hvor
`selDay` ligger i den globale state. Det samme gælder fejringens udgangspunkt: en `effect` i
servicen følger `goalReached()`, når `ready()` er sand (ellers nulstilles udgangspunktet), og
sætter `celebrationDue`, når målet nås bagefter – også mens Hjem er på en anden fane. Servicen
holder ingen timere – fejrings-toastens timer hører til siden og ryddes, når siden forlades.

**Dage og data:** ugen ruller: `weekDays` henter i dag − 6 … i dag fra
`FoodLogService.dailyTotals`, forankret i `FoodLogService.today` (skifter ved midnat). `dayTotals`
giver `null` for dage uden poster. `dayParts` (andel af kaloriemålet), ringene og ugens nøgletal
(inkl. "protein ramt" for hver dag) bygger alle på `dayTotals`. `null` giver tom ring, `–` i
dagskortet og ingen andel i nøgletallene. Gennemsnittet er `–`, ikke 0, når ingen dage tæller med.
Kun dagskortet viser i dag som 0 kcal og 0 g, når madloggen er `ready` (spec 5.2) – mens den
indlæses, står der `–`, og nøgletallene tæller stadig kun dage med poster. "kcal i snit" er de
loggede kalorier, også over målet. Dagstallene er summen af API'ets præcise værdier og afrundes
først ved visning. Streaken er `1 dag` / `N dage` (`home.summary.streakOne` / `streak`).

**Før data er hentet:** målet (kcal og makroer, også i `dayRows`) er `–`, til
`UserProfileService.goal` er hentet – aldrig et tavst 0 (5.3). `weekSummary` er `–` uden
opsamling, til madloggen er `ready` og målet hentet. `todos` foreslår kun vejning, når
vejningerne er `ready`, og måltider, når madloggen er `ready`. Vejningen sammenlignes med Hjems
egen dag (`FoodLogService.today`), så "Husk at veje dig i dag" kommer igen efter midnat.

**Seneste 30 dage:** `dayRows` er `dailyTotals(i dag − 29, i dag)` vendt om: `id` (ISO-dato),
`label` (`Tor. 24. sep`), `kcalText` (`1.850 / 2.100 kcal`, `–` uden poster) og `macroText`
(`P 120 g · K 200 g · F 60 g`, tom uden poster). Kalorier og gram vises som hele tal.
