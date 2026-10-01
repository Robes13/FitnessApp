# FoodMealGroup

Én måltidsgruppe på Mad-skærmen (`app-food-meal-group`): overskrift med måltidets kalorier,
de loggede varer og linket "+ Tilføj til <måltid>".

Gruppen får en færdig `MealGroupView` fra `FoodViewService` og udsender `edit`, `removed` og
`add`. Den kender hverken loggen eller måltidernes rækkefølge. Rækkens kcal vises som hele tal
(`kcal(entry)`), fordi loggen har API'ets præcise værdier.

En tom gruppe viser kun tilføj-linket og en tankestreg i stedet for kalorier — som i designet.
Der er derfor bevidst ingen `app-ui-empty-state` her.
