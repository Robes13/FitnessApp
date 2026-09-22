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
- **Redigér og slet.** Er id'et en af brugerens egne samlinger (`col:<id>`, se
  `CollectionsViewService.editableCollectionFor()`), får sidehovedet en blyant ("Rediger
  samling"), der åbner `NewCollectionSheet` udfyldt, og bunden får "Slet samling". Sletning
  kræver bekræftelse i `DeleteCollectionSheet`; derefter kaldes `CollectionsService.remove()`,
  og appen går tilbage til `APP_PATH.COLLECTIONS`. Retter og løse varer har ingen af delene.
- Hero'ens højde er `--size-recipe-hero` (designets 150 px).
