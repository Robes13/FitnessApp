# HomeGoalCard

Det orange "Til mål"-kort (`app-home-goal-card`): afstanden til målvægten, selve målvægten,
fremdriften og en kort vejledning ud fra det valgte tempo. Bygget på `app-ui-card`
(`tone="accent"`) og `app-ui-progress-bar` (`tone="inverse"`, den mørke bjælke på det orange
kort).

Input `summary` fra `HomeSummaryService.goalSummary()`. Siden skjuler hele kortet, til API'ets mål
er hentet, og når profilens mål er `hold`.
