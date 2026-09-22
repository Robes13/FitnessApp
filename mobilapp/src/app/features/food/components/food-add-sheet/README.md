# FoodAddSheet

"Tilføj mad"-arket (`app-food-add-sheet`): `app-ui-sheet` om måltids-chips, fanerne
Varer/Samlinger og enten `app-food-picker` eller listen over samlinger.

- Titlen sættes gennem `UiSheet`s `title` / `titleAccent` — "Tilføj **morgenmad**" eller
  "Rediger **vare**" (designets `addSheetVerb` / `addSheetWhat`).
- Fanerne vises kun på vælgerens søgetrin (designets `addTabsVisible`), mens måltids-chipsene
  også bliver stående på portionstrinnet (designets `showMealPicks`). Begge dele skjules i
  "Ny egen vare" og under redigering.
- Indholdet ligger bag `@if (open())`, så vælgeren starter forfra ved hver åbning.
- En samling logges som **én** vare: navn, `n varer` og summen fra
  `CollectionsService.collectionTotals`. Uden samlinger med indhold vises `app-ui-empty-state`.

- Under redigering slår arket den egne vare op, som posten blev logget fra
  (`FoodLogService.customFoods`, samme `id`), og giver den til vælgeren som `editBaseItem`.
  Så kan kcal og makroer også rettes. Systemvarer (uden `isCustom`) kan kun få ny mængde.

Arket ændrer ikke loggen. Det udsender `selected` (færdig vare), `customFoodCreated`,
`customFoodEdited`, `scanRequested` og `closed`; `meal` er en `model`, så chipsene kan flytte
måltidet.
