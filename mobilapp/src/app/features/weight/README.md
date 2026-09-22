# Vægt

Fanen **Vægt**: registrér dagens vægt på en badevægt, gem vejningen og se udviklingen i en
graf med intervallerne 1 uge / 4 uger / 3 mdr. samt en liste over de seneste vejninger.

| Fil / mappe                                         | Indhold                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `weight.routes.ts`                                  | `WEIGHT_ROUTES` – featurens eneste indgang (`WeightPage` på `/vaegt`).  |
| [`pages/weight-page/`](pages/weight-page/README.md) | Skærmen: overskrift, kladdevægt, nøgletal, lineal, "Gem vejning", graf. |
| [`services/weight-view.ts`](services/README.md)     | `WeightViewService` – alle afledte værdier på skærmen.                  |
| [`components/`](components/README.md)               | Badevægt-scenen, grafkortet og listen over vejninger.                   |

## Data

Featuren har ingen egen persistens. Den læser og skriver via `core/services`:

- `WeightLogService` – vejningerne (nyeste først), `add()` og grafens punkter `seriesFor()`.
- `UserProfileService` – vægt, højde, mål og målvægt. `WeightLogService.add()` opdaterer selv
  profilens vægt, så Hjem, Mad og kaloriemålet følger med.

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
- **Linealen er den fælles `UiRuler`** i `size="lg"` (96 px) med `step` 0,1 kg og streger for
  hvert kilo. −/+ knapperne ligger oven på dens ender og springer ét trin.
- **Kortlivede animationer styres af siden**, ikke af servicen: "Gemt ✓" i 1,4 s og figurens
  blik i 0,9 s. Begge timere ryddes i `DestroyRef.onDestroy`.
