# HomeTodoCard

"Næste skridt" (`app-home-todo-card`): det øverste uafsluttede gøremål som et orange
gradient-kort. Kortet er et `<a routerLink>`, fordi det navigerer – til `/vaegt` eller til
`/mad?tilfoej=<måltid>`, så Mad åbner tilføj-arket med det rigtige måltid.

Inputs `todo` (sti og query-parametre kommer færdige fra `HomeSummaryService`) og
`countLabel` (`1 / 3` eller `Kun én`). Er der ingen gøremål, viser siden slet ikke kortet.
