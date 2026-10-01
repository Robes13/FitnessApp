# FoodAddSheet

"Tilføj mad"-arket (`app-food-add-sheet`): `app-ui-sheet` om måltids-chips, fanerne
Varer/Samlinger og enten `app-food-picker` eller listen over samlinger.

- Titlen sættes gennem `UiSheet`s `title` / `titleAccent` — "Tilføj **morgenmad**" eller
  "Rediger **vare**" (designets `addSheetVerb` / `addSheetWhat`).
- Fanerne vises kun på vælgerens søgetrin (designets `addTabsVisible`), mens måltids-chipsene
  også bliver stående på portionstrinnet (designets `showMealPicks`). Begge dele skjules i
  "Ny egen vare" og under redigering.
- Indholdet ligger bag `@if (open())`, så vælgeren starter forfra ved hver åbning.
- **Fanen "Samlinger"** viser brugerens samlinger (navn, varernes navne, afrundet kcal). Et tryk
  logger samlingen under det valgte måltid med `CollectionsService.log()` – ét kald, én række pr.
  vare (P13). Imens er rækkerne slået fra (`aria-busy`); bagefter udsender arket `closed`. En
  fejl ("Samlingen blev ikke logget. Prøv igen.") vises øverst, og arket bliver åbent. Uden
  samlinger vises `app-ui-empty-state`.

- Under redigering kan kun mængden ændres (spec 3.3) – makroerne på en egen vare rettes ikke
  her.
- `busy` (siden gemmer) går videre til vælgeren, så dens knap viser spinner, og slår
  samlingsrækkerne fra (`aria-busy`). `error` (siden har oversat fejlen) vises øverst med
  `app-ui-form-error`. Arket bliver stående ved en fejl, så brugerens tal ikke går tabt.

Arket ændrer kun loggen, når en samling logges. Ellers udsender det `selected` (færdig vare),
`customFoodCreated`, `scanRequested` og `closed`; `meal` er en `model`, så chipsene kan flytte
måltidet.
