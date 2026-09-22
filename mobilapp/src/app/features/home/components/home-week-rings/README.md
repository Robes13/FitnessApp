# HomeWeekRings

Ugens syv dagsringe (`app-home-week-rings`). Hver ring viser dagens andel af kaloriemålet:
grøn når ringen er lukket, orange undervejs og tom for dage, der ikke er kommet endnu. I dag
har en orange prik i midten, og den valgte dag en tynd orange yderring.

Ringene tegnes som SVG (viewBox 40×40, r 16 → omkreds 100,5), fordi de skal bære både halo,
markering og midterprik – `app-ui-progress-ring` dækker kun selve fremdriften.

Inputs `rings` (fra `HomeSummaryService.weekRings()`) og `celebrating`; output `selected`
med ugedagens indeks. Når `celebrating` er sat, lukker dagens ring med `ringClose` og en grøn
`ringHalo` – begge globale keyframes fra `src/styles/_animations.scss`.
