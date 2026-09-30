# Home – komponenter

Feature-specifikke byggeklodser til Hjem. De er præsentations-komponenter: de modtager
færdige værdier fra `HomeSummaryService` via inputs og melder tilbage med outputs. Eneste
undtagelse er `VerifyEmailSheet`, der selv taler med `SessionService`,
fordi den ejer sit eget lille flow.

| Komponent              | Selector                     | Rolle                                     |
| ---------------------- | ---------------------------- | ----------------------------------------- |
| `HomeWeekRings`        | `app-home-week-rings`        | Ugens syv dagsringe, vælger dagen         |
| `HomeTodoCard`         | `app-home-todo-card`         | "Næste skridt" – link til Vægt eller Mad  |
| `HomeDayCard`          | `app-home-day-card`          | Den valgte dags kalorier, vægt og makroer |
| `HomeGoalCard`         | `app-home-goal-card`         | Det orange "Til mål"-kort                 |
| `HomeWeekCard`         | `app-home-week-card`         | Ugens fire nøgletal og opsamlingen        |
| `HomeCelebrationToast` | `app-home-celebration-toast` | "Dagsmål nået"                            |
| `VerifyEmailSheet`     | `app-verify-email-sheet`     | "Tjek din mail" – kan ikke lukkes         |

Ingen af dem må bruges uden for `features/home/`. Skal noget genbruges, flyttes det til
`shared/components/`.
