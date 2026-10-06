# Samlinger

Fanen "Samling" og skærmen bag den: en liste med brugerens madsamlinger (spec 4.0–4.2) – og en
detaljeskærm, hvor en samling logges som spist under et valgt måltid (spec 3.2), redigeres og
slettes.

| Fil / mappe                        | Indhold                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `collections.routes.ts`            | `COLLECTIONS_ROUTES`: listen på `''` og opskriften på `:recipeId` (uden tab bar).                  |
| `services/collections-view.ts`     | `CollectionsViewService` – listens rækker, opskriftens data og skærmenes fælles indlæsningsstatus. |
| `components/meal-picker/`          | De fire måltider som 2×2-gitter. Vælger måltidet, samlingen logges under, på opskriften.           |
| `components/new-collection-sheet/` | Arket "Ny samling" / "Rediger samling" med navn, kladde, vare-søgning og stregkodescanner.         |
| `pages/collections-page/`          | Listeskærmen: titel, indlæsning/fejl/tom, kort og knappen, der åbner arket.                        |
| `pages/recipe-page/`               | Opskriftsskærmen: hero, makroer, indhold, "Log X kcal" under et måltid – og redigér/slet.          |

## Rutens id

Opskriftsskærmen nås med samlingens id (`<mealCollectionId>`). `CollectionsViewService.detailFor()`
svarer `null` for et ukendt id – så viser skærmen en tom tilstand med en vej tilbage (eller en
spinner/fejl, mens samlingerne hentes). `APP_PATH.recipe(id)` bygger stien.

Opskriften er en fuldskærm: ruten sætter `data: { [ROUTE_DATA.HIDE_TAB_BAR]: true }`, og
shell'en fjerner tab baren (designets `navVisible`).

## Beslutninger

- **Samlingerne kommer fra API'et** (`CollectionsService`, `me/meal-collections`). Ikon, måltid
  på samlingen, faste samlinger, retter og løse varer er slettet (P13 – hverken i spec'en eller
  API'et). Alle kort og heroen bruger derfor ikonet `utensils` i accent-farven.
- **Næringen regnes i appen.** API'ets `MealItemDto` har ingen næring, så hver vare skaleres fra
  sin madvare i `FoodLogService.foods`. Skærmene venter derfor på både samlingerne og madloggen
  (`CollectionsViewService.status`) – også opskriften og plus-knappen – og "Prøv igen"
  genindlæser den, der fejlede.
- **Mindst én vare** (spec 4.0/4.1-8a): arket kan ikke gemme uden varer og siger hvorfor. API'et
  tillader højst 50; ved 50 er "Søg vare" og "Scan" slået fra. Navnet er højst 100 tegn.
- **Unikke navne kun i appen.** Arket afviser et navn, en anden samling har (trimmet, uden
  hensyn til store/små bogstaver); API'et accepterer dubletter.
- **Arket skriver ikke selv.** `NewCollectionSheet` udsender `created`/`updated`; siden kalder
  `CollectionsService` og lukker arket først, når API'et har svaret (pessimistisk). En fejlet
  oprettelse vises i arket, som bliver åbent – et nyt forsøg er sikkert, fordi `ensureFood`
  genbruger de madvarer, der allerede blev oprettet.
- **Redigering er en diff** (P13): `PATCH` navn → `POST` nye varer → `DELETE` fjernede → `GET`.
  En vare med ny mængde lægges i kladden uden `mealItemId`, så den slettes og tilføjes igen.
  Diffen er ikke atomar: fejler et trin, hentes samlingen igen, arket lukker, og opskriften viser
  fejlen og det, API'et nåede at gemme – så et nyt forsøg aldrig tilføjer en vare to gange. Kan
  samlingen ikke hentes igen, viser skærmene indlæsningsfejlen med "Prøv igen" i stedet for en
  redigering bygget på gamle id'er. En samling, der er slettet på en anden enhed (404), forsvinder
  fra skærmene.
- **Arket viser kladdens samlede næring** (kcal, protein, kulhydrat og fedt – spec 4.0/4.1),
  genberegnet ved hver ændring. Det kan
  ikke gemme, mens en ny egen vare stadig gemmes (ellers ville `ensureFood` oprette den igen).
- **Log som spist** = `POST …/{id}/log` med måltidstypen: N almindelige madlog-rækker, der hver
  kan rettes og fjernes på Mad (P13). Ingen multiplikator. Mad-arkets fane "Samlinger" bruger
  samme kald – efter et bekræftelsestrin med samlingens næring og "Fortryd" (spec 3.2).
- **Slet kræver bekræftelse** (spec 4.2) i det fælles `shared/components/ui-confirm-sheet`.
  Kun samlingen slettes – madvarerne og madlog-rækker fra samlingen bliver stående, og
  bekræftelsen siger det. En samling, der allerede er væk (404), tæller som
  slettet.
