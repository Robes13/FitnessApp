# UiRuler

Designets lineal: et vandret spor af streger, der trækkes under en fast orange midterlinje.
Bruges til vægt (30–300 kg), højde (100–250 cm), skridt (0–50.000), træningslængde (10–180 min)
og målvægt i opret-flowet samt til ny vejning (0,1 kg-trin) på Vægt-siden.

## Filer

| Fil                 | Indhold                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `ruler-geometry.ts` | `computeRulerGeometry()` – ren funktion, generisk port af designets `ruler()` og `stepRuler()`. |
| `ui-ruler.ts`       | `UiRuler` (`app-ui-ruler`) – træk, tastatur, slider-semantik.                                   |

## Brug

```html
<!-- Vægt: 1 kg pr. streg, etiket hver 10 -->
<app-ui-ruler [min]="30" [max]="300" [(value)]="weightKg" ariaLabel="Vægt i kilo" />

<!-- Skridt: 100 skridt pr. streg, 5,6 px pr. streg, etiket hver 2.000 som "2k" -->
<app-ui-ruler
  [min]="0"
  [max]="50000"
  [(value)]="steps"
  [step]="100"
  [tickUnit]="100"
  [pxPerTick]="5.6"
  [labelEvery]="20"
  [glowReach]="8"
  [labelFormatter]="formatSteps"
  [(dragging)]="isDragging"
/>

<!-- Ny vejning: 0,1 kg-trin, 96 px høj -->
<app-ui-ruler [min]="30" [max]="300" [(value)]="newWeight" [step]="0.1" size="lg" />
```

| Input            | Standard         | Betydning                                                                |
| ---------------- | ---------------- | ------------------------------------------------------------------------ |
| `min` / `max`    | påkrævet         | Grænser i værdi-enheder                                                  |
| `value`          | påkrævet (model) | Aktuel værdi, to-vejs                                                    |
| `step`           | `1`              | Opløsning for den committede værdi                                       |
| `tickUnit`       | `1`              | Værdi pr. streg                                                          |
| `pxPerTick`      | `8`              | Pixel pr. streg                                                          |
| `majorEvery`     | `10`             | Hver n'te streg (absolut streg-nummer) er stor                           |
| `midEvery`       | `5`              | Hver n'te streg er mellemhøj                                             |
| `labelEvery`     | `10`             | Hver n'te streg får etiket                                               |
| `labelFormatter` | `String(v)`      | `(tickValue) => string` – fx `2000 → '2k'`                               |
| `glowReach`      | `6`              | Hvor mange streger gløden rækker (designets skridt-lineal bruger 8)      |
| `glowStrength`   | `0.35`           | Glødens styrke i hvile (vægt, højde og skridt bruger designets 0.4)      |
| `size`           | `'md'`           | `md` = 84 px, `lg` = 96 px (`--size-ruler-h`, `--size-ruler-h-lg`)       |
| `ariaLabel`      | `''`             | Skærmlæser-navn for slideren                                             |
| `dragging`       | `false` (model)  | `true` mens brugeren trækker – gløden forstærkes, forælderen kan reagere |

Værten er `display: block; overflow: hidden`. Forælderen sætter margin (designet bruger
`margin: 12px -24px 0` for kant-til-kant), baggrund og radius (Vægt-siden lægger linealen i et
kort med `--color-surface-3` og `--radius-xl` og placerer −/+-knapper ovenpå).

## Geometri (port af designet)

For hver streg `i` (værdi `min + i · tickUnit`):

- højde: 34 (aktuel) / 28 (stor) / 18 (mellem) / 10 (lille) **+** `round(near · 9)`
- `near = max(0, 1 − |i − værdi-i-streger| / reach) · bleed`, hvor `bleed` er **0,35 i hvile og
  1 under træk**
- farve: aktuel → `--color-accent`; stor → `--color-ruler-tick-major` (slate-300); lille →
  `--color-ruler-tick-minor` (slate-600, ens i begge temaer); gløder (`near > 0,06`, ikke aktuel) →
  `color-mix(in srgb, var(--color-accent) X%, transparent)` med `X = round((0,3 + 0,7 · near) · 100)`,
  bundet pr. streg som `--ruler-tick-glow`
- sporet forskydes `−(værdi − min) / tickUnit · pxPerTick` px via `--ruler-offset` på værten,
  med `transition: transform 80ms linear`

Stor/mellem/etiket afgøres af det **absolutte** streg-nummer (`tickValue / tickUnit`), så
30-kg-linealen har store streger ved 30, 40, 50 … og skridt-linealen ved 0, 1.000, 2.000 …
uanset `min`.

`ui-ruler.spec.ts` låser geometrien mod værdier beregnet med designets originale funktioner
i node (vægt 75 i hvile, under træk, 75,4 og skridt 6.000).

## Interaktion

- **Træk:** et usynligt lag (`role="slider"`, `touch-action: none`) over hele linealen. Ved
  nedtryk committes værdien under fingeren (`value + (clientX − midte) / pxPerUnit`), og
  bevægelser måles relativt til startpunktet. Pointer capture holder trækket, selv om fingeren
  forlader elementet.
- **Tastatur:** `←`/`→` (og `↑`/`↓`) ± `step`, `Home`/`End` til min/max.
- Alle commits rundes til nærmeste `step`, rundes til tre decimaler (mod flydende-tal-støj) og
  klemmes fast til `min..max`.
- `aria-valuemin/max/now` følger inputs og værdi.
