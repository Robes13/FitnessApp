# HomeWeekRings

Ringene for de seneste 7 dage (`app-home-week-rings`), i dag − 6 … i dag med i dag sidst. Hver
ring viser dagens andel af kaloriemålet: grøn når ringen er lukket, orange undervejs og tom for
dage uden poster (og for 0 kcal – en rund linjeende uden længde ville ellers tegne en prik). I dag
har en orange prik i midten, og den valgte dag en tynd orange yderring.

Ringene tegnes som SVG (viewBox 40×40, r 16 → omkreds 100,5), fordi de skal bære både halo,
markering og midterprik – `app-ui-progress-ring` dækker kun selve fremdriften.

Inputs `rings` (fra `HomeSummaryService.weekRings()`) og `celebrating`; output `selected`
med dagens indeks i den rullende uge (0 = for seks dage siden, 6 = i dag). Når `celebrating`
er sat, lukker dagens ring med `ringClose` og en grøn `ringHalo` – begge globale keyframes fra
`src/styles/_animations.scss`. Haloen skaleres op til 1,8 og når ud over viewBox'en, så SVG'en har
`overflow: visible` – ellers klippes den til en firkant.
