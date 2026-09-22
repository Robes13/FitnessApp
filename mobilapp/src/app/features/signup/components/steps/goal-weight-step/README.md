# GoalWeightStep

Signup-trinnet `goal-weight` (`app-goal-weight-step`) — designets `sMaal`,
"Hvad er din **målvægt?**". Trinnet springes over, når målet er "holde vægten"
(`SignupStateService.visibleOrder`).

## Skalaen

Grænserne kommer fra `NutritionCalculator.goalWeightBounds(goal, weightKg)`: vil man tage
på, starter skalaen lige over vægten i dag; ellers stopper den lige under. Kladdens værdi
klemmes ind i grænserne (designets `goalW`), så trinnet altid viser en gyldig målvægt, også
hvis målet er skiftet bagefter. `UiRuler` får de dynamiske `min`/`max` og skriver tilbage i
`goalWeightKg`. Linealen har negativ sidemargin, så den går ud til skærmkanten som i designet.

## Tekster

- Delta-pillen: `−5,0 kg fra nu` / `+3,5 kg fra nu` / `Samme som nu`.
- Under tallet: `Nu: 75 kg. Træk i skalaen nedenfor.`
- Advarslen vises kun, når `NutritionCalculator.isGoalWeightRealistic` er falsk — enten
  "Det mål er for lavt for din højde." eller "Det mål er meget højt for din højde.".
  Pladsen er reserveret, så layoutet ikke hopper. Samme regel styrer, om man kan gå videre.

## Scenen

Figuren tegnes ved **målvægten** (`FigureBody` med humør 0,4 ved "tage på", ellers 0,6) oven
på et stiplet omrids af kroppen **i dag**, så forskellen kan aflæses direkte. Skyggen tegnes
manuelt før omridset, så lagrækkefølgen matcher designet; derfor er `showShadow` slået fra på
`FigureBody`. Omridsets grå er figurens egen konstante farve, så det også ses i lyst tema.

De tre faste mål fra designet (tekstbredder og figurens maksbredde) bindes som CSS-variabler
fra `GOAL_WEIGHT_LAYOUT` i `.ts` — samme mønster som `BarcodeScanner`.

Figurens koordinater opdateres samlet gennem `animatedFigure`, så kropsdele og afledte
rekvisitter deler samme frame ved hurtige inputskift. Se fælles figur-dokumentation for
afbrydelse, tempo og reduceret bevægelse.
