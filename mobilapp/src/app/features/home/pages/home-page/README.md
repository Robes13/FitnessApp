# HomePage

Route-komponenten for `/hjem`. Layoutet følger sidekonventionen: `page-screen` på host,
`scroll-area` på indholdet og en spacer på `--layout-tab-bar-clearance`, så tab baren ikke
dækker det sidste kort.

Rækkefølgen er designets: hilsen og avatar → ugens ringe → "Næste skridt" → dagens kort →
målkortet → ugens kort.

## Fejringen

Siden ejer fejrings-toasten. En `effect` følger `HomeSummaryService.goalReached()`, og det er
kun **overgangen** fra "ikke nået" til "nået", der fejrer – åbnes Hjem, mens målet allerede er
nået, sker der ingenting (som i designet, hvor `_goalHit` huskes på tværs af skærme). Toasten
vibrerer, hvor enheden kan, ligger på skærmen i 3,4 s og kan trykkes væk. Timeren ryddes i
`DestroyRef.onDestroy`, så der ikke er noget tilbage, når siden forlades.

## Avataren

Headeren bruger den delte `ProfileAvatar` (`shared/components/profile-avatar`) med
`HomeSummaryService.photo()`. Komponenten ejer designets beskæringsformler, så Hjem og Profil
viser nøjagtig samme udsnit. Er der intet billede, vises forbogstavet på den blå cirkel.
