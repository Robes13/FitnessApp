# GoalStep

Signup-trinnet `goal` (`app-goal-step`) — designets `s4`, "Hvad er dit **mål?**".

Tre valgkort (`UiOptionCard` med `selectionStyle="selected"`, altså designets blå `sel()`)
bygget på `GOALS` fra `core/constants/nutrition`. Til højre står designets glyf `↓` / `=` /
`↑`. Glyffens farve er **fast pr. mål** (orange / dæmpet / blå) og skifter ikke, når kortet
vælges — det er sådan designet gør det.

Valget gør tre ting, præcis som designets `goalsDef[].pick`:

1. sætter `goal`,
2. nulstiller `pace` (tempoet hører til det gamle mål), og
3. foreslår en målvægt: 5 kg under vægten i dag (dog mindst `GOAL_WEIGHT_MIN_KG`) ved
   "tabe mig", 5 kg over ved "tage på", og vægten i dag ved "holde vægten".

Trinnet har hverken inputs eller outputs: det injicerer `SignupStateService` og skriver
direkte i kladde-signalerne.
