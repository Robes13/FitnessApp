# Samlinger

Fanen "Samling" og skærmen bag den: én liste med brugerens samlinger og deres varer — og en
detaljeskærm, hvor indholdet kan logges som spist.

Appen har ingen retter og ingen faste samlinger endnu; de skal komme fra backenden. Indtil da
er listen kun brugerens egne samlinger, og filter-chipsene er bare "Alle".

| Fil / mappe                        | Indhold                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `collections.routes.ts`            | `COLLECTIONS_ROUTES`: listen på `''` og opskriften på `:recipeId` (uden tab bar).                  |
| `services/collections-view.ts`     | `CollectionsViewService` – oversætter `CollectionsService` til listens rækker og opskriftens data. |
| `components/meal-picker/`          | De fire måltider som 2×2-gitter. Bruges af både "Ny samling" og opskriften.                        |
| `components/new-collection-sheet/` | Arket "Ny samling" med kladde, vare-søgning og stregkodescanner.                                   |
| `pages/collections-page/`          | Listeskærmen: titel, filter-chips, kort og knappen, der åbner arket.                               |
| `pages/recipe-page/`               | Opskriftsskærmen: ikon-hero, makroer, indhold og "Log X kcal".                                     |

## Rutens id'er

Opskriftsskærmen kan nås med tre slags id'er, præcis som i designet (`openRecipe`):

| Id                | Betyder                                        |
| ----------------- | ---------------------------------------------- |
| `skyr`            | En ret fra backenden (der findes ingen endnu). |
| `col:<samlingId>` | En hel brugersamling vist som ét "bundt".      |
| `<vareId>`        | En løs vare, der er lagt i en samling.         |

`CollectionsViewService.detailFor()` slår alle tre op og svarer `null`, når intet passer –
så viser skærmen en tom tilstand med en vej tilbage. `APP_PATH.recipe(id)` bygger stien;
kolon er et lovligt tegn i et rute-segment og overlever Angulars URL-serializer.

Opskriften er en fuldskærm: ruten sætter `data: { [ROUTE_DATA.HIDE_TAB_BAR]: true }`, og
shell'en fjerner tab baren (designets `navVisible`).

## Beslutninger

- **Farven følger måltidet.** Designet slår tinten op på samlingens id (`c1`–`c4`) og falder
  tilbage på ikonets tint. Modellen i `core` har et rigtigt `meal`-felt, så tonen udledes af
  det: morgenmad orange, frokost grøn, aftensmad blå, snacks rød. Ikon-tabellen (`colTints`)
  er derfor ikke portet.
- **Rækkefølgen er designets.** Først brugerens samlinger som bundter, så løse varer i de
  faste samlinger, til sidst retterne. Et valgt filter viser den faste samling, dens retter og
  de af brugerens samlinger, der hører under samme måltid. Faste samlinger og retter findes
  først, når backenden leverer dem, så i dag er der kun bundter.
- **Arket skriver ikke selv.** `NewCollectionSheet` udsender `created` med en
  `NewCollectionInput`; siden kalder `CollectionsService.create()` og slår filteret om til det
  måltid, samlingen hører under (designets `createCol`, der også sætter `colId`).
- **Ingen egne opskriftsdata.** Retter, samlinger og varer kommer fra `CollectionsService`;
  featuren tilføjer kun visningslogik.
- Designet viser ikke rettens fremgangsmåde (`steps`) på opskriftsskærmen – kun "Indhold".
  Trinnene ligger i modellen og kan tilføjes uden ændringer her.
