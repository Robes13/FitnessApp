# RecipePage

Designets "Opskrift" (HTML-linje 1281). `UiPageHeader` med "Opskrift", ikon-hero i måltidets
tint, titel, undertekst, fire makro-fliser, "Indhold" og kortet "Log som spist under".

- `recipeId` bindes fra ruten med `withComponentInputBinding()`. Feltnavnet skal matche
  `ROUTE_PARAM.RECIPE_ID`; Angular kræver en statisk streng som alias, så konstanten kan kun
  bruges i `collections.routes.ts`. Specen dækker begge sider af den kobling.
- Id'et kan være en ret, et bundt (`col:<id>`) eller en løs vare — se feature-README'en.
  Findes intet, vises en tom tilstand og en vej tilbage til listen.
- Det valgte måltid starter på rettens eget (`linkedSignal`), så et nyt id nulstiller valget.
- "Log X kcal" lægger posten i `FoodLogService` som én portion og skifter til Mad, præcis som
  designets `logRecipe`.
- Hero'ens højde er `--size-recipe-hero` (designets 150 px).
