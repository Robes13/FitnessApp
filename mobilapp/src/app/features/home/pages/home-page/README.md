# HomePage

Route-komponenten for `/hjem`. Layoutet følger sidekonventionen: `page-screen` på host,
`scroll-area` på indholdet og en spacer på `--layout-tab-bar-clearance`, så tab baren ikke
dækker det sidste kort.

Rækkefølgen er designets: hilsen og avatar → (fejlbesked + "Prøv igen") → de seneste 7 dages
ringe → "Se de seneste 30 dage" → "Næste skridt" → dagens kort → målkortet → 7-dageskortet.

## Fejl og 30-dages-arket

Når `HomeSummaryService.loadFailed()` er sand, står "Dine data kunne ikke hentes."
(`app-ui-form-error`) og en "Prøv igen"-knap (`app-ui-button`) over ringene; knappen kalder
`HomeSummaryService.reload()`. Den lille ghost-knap under ringene åbner `HomeMonthSheet` med
`HomeSummaryService.dayRows()`; siden ejer `open` (`monthSheetOpen`).

## Fejringen

Siden ejer fejrings-toasten. En `effect` følger `HomeSummaryService.goalReached()`, og det er
kun **overgangen** fra "ikke nået" til "nået", der fejrer. Data kommer asynkront fra API'et, så
effekten venter på `HomeSummaryService.ready()` (madlog og profil hentet): den første værdi
derefter er udgangspunktet. Et mål, der allerede er nået, når data er hentet, fejres derfor ikke
ved hver app-start – først at nå det bagefter gør. Toasten vibrerer, hvor enheden kan, ligger på
skærmen i 3,4 s og kan trykkes væk. Timeren ryddes i `DestroyRef.onDestroy`, så der ikke er noget
tilbage, når siden forlades.

## Avataren

Headeren bruger den delte `ProfileAvatar` (`shared/components/profile-avatar`) med
`HomeSummaryService.photo()`. Komponenten ejer designets beskæringsformler, så Hjem og Profil
viser nøjagtig samme udsnit. Er der intet billede, vises forbogstavet på den blå cirkel.
