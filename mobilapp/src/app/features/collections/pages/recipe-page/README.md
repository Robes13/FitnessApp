# RecipePage

Designets "Opskrift" (HTML-linje 1281). `UiPageHeader` med "Opskrift" og en blyant ("Rediger
samling"), hero med ikonet `utensils`, titel, varernes navne, fire makro-fliser, "Indhold" og
kortet "Log som spist under" – og nederst "Slet samling".

- `recipeId` bindes fra ruten med `withComponentInputBinding()`. Feltnavnet skal matche
  `ROUTE_PARAM.RECIPE_ID`; Angular kræver en statisk streng som alias, så konstanten kan kun
  bruges i `collections.routes.ts`. Specen navigerer via ruten og dækker dermed koblingen.
- Id'et er `col:<id>` (se feature-README'en). Findes samlingen ikke, viser siden en spinner,
  mens samlingerne hentes, en fejl med "Prøv igen", hvis de ikke kunne hentes, og ellers en tom
  tilstand med en vej tilbage.
- **Log** (spec 3.2): `MealPicker` vælger måltidet (start: morgenmad), og "Log X kcal" kalder
  `CollectionsService.log(id, måltid)` – ét kald, én madlog-række pr. vare – og skifter til Mad,
  når API'et har svaret.
- **Redigér** (spec 4.1) genbruger `NewCollectionSheet` udfyldt; "Gem ændringer" kalder
  `CollectionsService.update()`. Arket lukker efter svaret – også ved en fejl, for så er
  samlingen hentet igen og viser, hvad API'et nåede at gemme.
- **Slet** (spec 4.2) kræver bekræftelse i det fælles `UiConfirmSheet`; derefter
  `CollectionsService.remove()` og tilbage til `APP_PATH.COLLECTIONS`.
- Én handling ad gangen (`pending`): log-knappen viser spinner, bekræftelsen og arket er `busy`.
  En fejl vises over log-knappen, og siden bliver stående. Kaldet afbrydes ikke, når siden
  forlades.
- Hero'ens højde er `--size-recipe-hero` (designets 150 px).
