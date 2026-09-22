# Vægt

Fanen **Vægt**: registrér dagens vægt på en badevægt, gem vejningen og se udviklingen i en
graf med intervallerne 1 uge / 4 uger / 3 mdr. samt en liste over vejningerne fra de sidste 3 mdr.,
hvor en vejning kan rettes eller slettes.

| Fil / mappe                                         | Indhold                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `weight.routes.ts`                                  | `WEIGHT_ROUTES` – featurens eneste indgang (`WeightPage` på `/vaegt`).  |
| [`pages/weight-page/`](pages/weight-page/README.md) | Skærmen: overskrift, kladdevægt, nøgletal, lineal, "Gem vejning", graf. |
| [`services/weight-view.ts`](services/README.md)     | `WeightViewService` – alle afledte værdier på skærmen.                  |
| [`components/`](components/README.md)               | Badevægt-scenen, linealen, grafkortet, listen og ret-arket.             |

## Data

Featuren har ingen egen persistens. Den læser og skriver via `core/services`:

- `WeightLogService` – vejningerne (nyeste først), `add()`, `update()`, `remove()`,
  `entriesWithin()` og grafens punkter `seriesFor()`.
- `UserProfileService` – vægt, højde, mål og målvægt. `WeightLogService` holder selv profilens
  vægt lig den seneste vejning ved hver ændring, så Hjem, Mad og kaloriemålet følger med.

Der er ingen netværkskald: en vejning gemmes lokalt og synkront, så skærmen har hverken
loading- eller fejltilstand. Den tomme tilstand (ingen vejninger endnu) håndteres to steder –
`Sidst vejet …` bliver til "Ingen vejninger endnu", og listen viser en tom tilstand.

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
- **Én vejning pr. dag.** Gemmer brugeren igen en dag, der allerede har en vejning, erstattes
  dagens vejning (samme id, ny vægt og ny tid) i stedet for at oprette en dublet. Det holder
  listen, grafen og "Siden sidst" meningsfulde, og en fejlvejning kan rettes blot ved at veje igen.
- **Ret og slet.** Tryk på en række i listen åbner `WeightEditSheet`. Use casen kræver kun, at den
  seneste vejning kan rettes, men alle viste rækker kan rettes – det koster intet ekstra.
  Rettes eller slettes den seneste vejning, følger profilens vægt den nye seneste. Slettes den
  eneste vejning, bliver profilens vægt stående (det er stadig brugerens sidst kendte vægt).
- **Listen viser højst 3 mdr. tilbage** (`WEIGHT_LOG_HISTORY_RANGE`, samme periode som grafens
  længste interval). Som udgangspunkt vises de 6 nyeste; "Vis alle" folder resten af de 3 mdr.
  ud. Ældre vejninger gemmes stadig, men vises ikke i listen.
- **Linealen er den fælles `UiRuler`** (pakket i `WeightRulerInput`, så siden og ret-arket deler den) i `size="lg"` (96 px) med `step` 0,1 kg og streger for
  hvert kilo. −/+ knapperne ligger oven på dens ender og springer ét trin.
- **Kortlivede animationer styres af siden**, ikke af servicen: "Gemt ✓" i 1,4 s og figurens
  blik i 0,9 s. Begge timere ryddes i `DestroyRef.onDestroy`.
