# Services (samlinger)

| Fil                   | Indhold                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `collections-view.ts` | `CollectionsViewService` – listens rækker (`entries()`), opskriftens data (`detailFor`) og `status`/`retry`. |

Servicen er ren udledning oven på `CollectionsService` og `FoodLogService` i `core`: den gemmer
ingenting og ejer ingen state, så metoderne kan kaldes fra en `computed()` og testes uden
komponenter.

- `collectionFor(routeId)` giver samlingen bag opskriftens rute-id (samlingens id), ellers `null`.
- `status` er `error`, hvis samlingerne eller madloggen fejlede, `loading`, mens en af dem
  hentes, og ellers `ready` – næringen kommer fra madloggens madvarer. `retry()` genindlæser kun
  den eller de stores, der fejlede.
