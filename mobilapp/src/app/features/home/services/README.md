# Home – services

`HomeSummaryService` (`providedIn: 'root'`) beregner alt, Hjem viser, ud fra core-lagrene
(`UserProfileService`, `AdaptiveGoalService` (kaloriemålet), `FoodLogService`, `WeightLogService`, `NutritionCalculator` og `NOW`).
Siden og kortene henter kun færdige værdier – ingen beregninger i templates.

| Signal / metode                       | Indhold                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `todayIndex`, `selectedDay`           | Ugedag 0 = mandag; valgt dag følger i dag, til brugeren vælger selv |
| `todayLabel`, `weekProgressLabel`     | `Torsdag 24. sep` og `Dag 4 af 7`                                   |
| `weekRings`                           | Syv ringe: andel, farve, i dag-prik og markering                    |
| `daySummary`                          | Den valgte dags titel, bjælke, kalorier, vægt og makroer            |
| `weekSummary`                         | Dage i mål, kcal i snit, protein ramt, streak og opsamlingen        |
| `todos`, `nextTodo`, `todoCountLabel` | Manglende vejning og måltider som "Næste skridt"                    |
| `showGoalCard`, `goalSummary`         | Målkortet (skjult ved målet `hold`)                                 |
| `goalReached`                         | Dagens kalorier har nået målet – udløser fejrings-toasten           |
| `photo`                               | Profilbilledet til avataren i headeren (`null` = vis forbogstavet)  |
| `selectDay(index)`                    | Vælger dagen, ringene og dagskortet viser                           |

**Hvorfor `root`:** den valgte dag skal overleve et faneskift, præcis som i designet, hvor
`selDay` ligger i den globale state. Servicen holder ingen timere – fejrings-toastens timer
hører til siden og ryddes, når siden forlades.

**Dage og data:** `dayTotals` henter ugens syv dage (mandag–søndag) fra
`FoodLogService.dailyTotals` og giver `null` for dage uden poster og for fremtidige dage.
`dayParts` (andel af kaloriemålet), dagskortets kcal/makroer og ugens nøgletal (inkl.
"protein ramt" for hver dag) bygger alle på `dayTotals`. `null` giver tom ring, `–` i
dagskortet og ingen andel i ugens nøgletal. Gennemsnittet er `–`, ikke 0, når ingen dage
tæller med.

`photo()` giver profilbilledet videre til den delte `ProfileAvatar`
(`shared/components/profile-avatar`), som ejer designets beskæringsformler
(`logic.js` `photoBg`/`photoSize`/`photoPos`). Hjem og Profil viser derfor nøjagtig samme
udsnit uden at duplikere formlerne.
