# Services (samlinger)

| Fil                   | Indhold                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `collections-view.ts` | `CollectionsViewService` – listens rækker (`CollectionEntry`), filter-chips og opskriftens data. |

Servicen er ren udledning oven på `CollectionsService` i `core`: den gemmer ingenting og
ejer ingen state. Det valgte filter bor i `CollectionsPage`, og metoderne tager det som
argument, så de kan kaldes fra en `computed()` og testes uden komponenter.

`BUNDLE_ID_PREFIX` (`col:`) er præfikset foran en samlings id, når hele samlingen åbnes som
én post. Se feature-README'en for de tre slags rute-id'er.
