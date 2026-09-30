# Vægt

Fanen **Vægt** (use case 6.0–6.3): registrér dagens vægt på en badevægt, gem vejningen og se
udviklingen i en graf med intervallerne 1 uge / 3 uger / 3 mdr. samt en liste over vejningerne fra
de sidste 3 mdr., hvor en vejning kan rettes eller slettes.

| Fil / mappe                                         | Indhold                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `weight.routes.ts`                                  | `WEIGHT_ROUTES` – featurens eneste indgang (`WeightPage` på `/vaegt`).  |
| [`pages/weight-page/`](pages/weight-page/README.md) | Skærmen: overskrift, kladdevægt, nøgletal, lineal, "Gem vejning", graf. |
| [`services/weight-view.ts`](services/README.md)     | `WeightViewService` – alle afledte værdier på skærmen.                  |
| [`components/`](components/README.md)               | Badevægt-scenen, linealen, grafkortet, listen og ret-arket.             |

## Data

Featuren har ingen egen persistens. Den læser og skriver via `core/services`, som taler med
API'et (`me/weight-logs`):

- `WeightLogService` – vejningerne (nyeste først, én side á 100), `add()` (`POST`), `update()`
  (`PATCH`), `remove()` (`DELETE`), `entriesWithin()` og grafens punkter `seriesFor()`.
- `UserProfileService` – vægt, højde, mål og målvægt. Profilens `load()` sætter vægten (seneste
  vejning, ellers startvægten). Efter hver ændring sætter `WeightLogService` profilens vægt til den
  nyeste vejning (`GET me/weight-logs/latest`, når der ingen er tilbage) og genindlæser målet, som
  API'et har genberegnet – så Hjem, Mad og kaloriemålet følger med.

**Tilstande:** Mens vejningerne eller profilen indlæses, viser skærmen en spinner i stedet for
indholdet; fejler en af dem, en besked og "Prøv igen", som kun genindlæser den, der fejlede. Uden
vejninger er profilens vægt startvægten fra registreringen: "Sidst vejet …" bliver til "Startvægt
fra registreringen" (6.1), og listen forklarer, at startvægten ikke kan rettes – brugeren skal
registrere en ny vejning først (6.2-2a). Alle viste rækker kan rettes og slettes; startvægten er
aldrig en række.

## Beslutninger

- **`WeightViewService` er feature-lokal og udstilles af `WeightPage`** (`providers: […]`), ikke
  `providedIn: 'root'`. Kladdevægten og det valgte interval hører til skærmen og nulstilles, når
  man forlader fanen – præcis som designets `newWeight10` og `range`. Alt, der skal overleve,
  ligger i core-storene.
- **Kladden regnes i tiendedele kilo.** Designet arbejder i `newWeight10` (heltal) for at undgå
  flydende-tal-støj; servicen runder derfor altid til nærmeste 0,1 kg og klemmer værdien fast
  mellem `WEIGHT_MIN_KG` og `WEIGHT_MAX_KG`.
- **Dansk komma overalt.** Alle tal formateres med `formatDecimal` / `formatSignedDecimal` fra
  `core/utils/date-format` – også grafens delta, hvor prototypen brugte punktum.
- **Intervalchipsene ligger under grafen** (designerens eksplicitte rækkefølge) og er
  `UiChip`-knapper med `flex: 1`.
- **En vejning pr. dag – med spørgsmål (6.0-4a/4b).** "Gem vejning" sender altid `POST` først.
  Har profilens kalenderdag allerede en vejning, svarer API'et 409 med `existingWeightLogId`, og
  arket "Overskriv **dagens vejning?**" spørger: "Ja, overskriv" sender `PATCH` med kladdens vægt
  og tiden nu, "Annuller" lukker uden kald. Der overskrives aldrig automatisk. Knapperne viser en
  spinner, mens der gemmes, så et dobbelttryk ikke sender to gange. Fejler gemningen, står fejlen
  under knappen (eller i arket); fejler kun genindlæsningen af målet bagefter, er vejningen gemt, og
  et nyt tryk giver spørgsmålet.
- **Ret og slet.** Tryk på en række i listen åbner `WeightEditSheet`. Use casen kræver kun, at den
  seneste vejning kan rettes, men alle viste rækker kan rettes – det koster intet ekstra. Gem og
  slet venter på API'et (spinner, arket kan ikke lukkes imens); fejler de, bliver arket åbent med
  fejlen. Rettes eller slettes den seneste vejning, følger profilens vægt den nye seneste; slettes
  den eneste, bliver den startvægten fra API'et.
- **3 uger i stedet for designets 4** (spec 6.3, plan-v2 P16) – også som standardinterval.
- **Listen viser højst 3 mdr. tilbage** (`WEIGHT_LOG_HISTORY_RANGE`, samme periode som grafens
  længste interval). Som udgangspunkt vises de 6 nyeste; "Vis alle" folder resten af de 3 mdr.
  ud. Ældre vejninger ligger stadig i API'et, men vises ikke i listen.
- **Linealen er den fælles `UiRuler`** (pakket i `WeightRulerInput`, så siden og ret-arket deler den) i `size="lg"` (96 px) med `step` 0,1 kg og streger for
  hvert kilo. −/+ knapperne ligger oven på dens ender og springer ét trin.
- **Kortlivede animationer styres af siden**, ikke af servicen: "Gemt ✓" i 1,4 s og figurens
  blik i 0,9 s. Begge timere ryddes i `DestroyRef.onDestroy`.
