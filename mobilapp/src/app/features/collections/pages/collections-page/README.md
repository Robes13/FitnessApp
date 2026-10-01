# CollectionsPage

Designets "Samlinger" (HTML-linje 1214). Titel, undertekst, orange plus-knap og listen af kort
– eller en spinner, mens samlingerne og madloggen hentes, en fejl med "Prøv igen"
(`CollectionsViewService.retry()`), og en tom tilstand uden samlinger.

Rækkerne kommer fra `CollectionsViewService.entries()`. Hvert kort har ikonet `utensils` i
accent-farven (API'et har intet ikon eller måltid på en samling).

Siden ejer arket "Ny samling" og den kørende oprettelse: `onCreated` kalder
`CollectionsService.create()`, arkets knap viser spinner imens (`busy`), og arket lukker først,
når API'et har svaret. En fejl vises i arket (`error`), som bliver åbent. Et tryk på et kort går
til `APP_PATH.recipe(entry.id)`.
