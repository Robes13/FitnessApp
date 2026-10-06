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

Siden ejer fejrings-toasten. Det er kun **overgangen** fra "ikke nået" til "nået", der fejrer, og
den følges af `HomeSummaryService` (root), ikke af siden: siden nedlægges ved hvert faneskift, og
mad logges på Mad-fanen, så målet næsten altid nås, mens Hjem er væk. Servicens udgangspunkt er
den første værdi, efter at madlog og profil er hentet (`ready()`), og det nulstilles, hver gang de
indlæses igen (også ved log ud/ind). Et mål, der allerede er nået, når data er hentet, fejres
derfor ikke – først at nå det bagefter gør, også på en anden fane.

En `effect` på siden læser `HomeSummaryService.celebrationDue()`, kalder `markCelebrated()` og viser
toasten – med det samme, eller når man vender tilbage til Hjem. Er målet ikke længere nået (en
logning er fjernet), bortfalder fejringen. Toasten vibrerer, hvor enheden kan, ligger på skærmen i
3,4 s og kan trykkes væk. Timeren ryddes i `DestroyRef.onDestroy`, så der ikke er noget tilbage,
når siden forlades.

Vibrationen er `navigator.vibrate()`. På Android kræver WebView'en `android.permission.VIBRATE`
(i `AndroidManifest.xml` – en normal tilladelse uden dialog). **iOS vibrerer ikke:** WKWebView har
ingen `navigator.vibrate`, så kaldet springes over, og toasten vises uden. Det ville kræve et
haptics-plugin (en ny afhængighed), og det er fravalgt for en "hvor enheden kan"-effekt.

## Avataren

Headeren bruger den delte `ProfileAvatar` (`shared/components/profile-avatar`) med
profilbilledet fra `UserProfileService`. Komponenten ejer designets beskæringsformler, så Hjem og Profil
viser nøjagtig samme udsnit. Er der intet billede, vises forbogstavet på den blå cirkel.
