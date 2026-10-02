# WeightChart

`app-weight-chart` – grafkortet på vægt-skærmen. Værten er selve kortet (`surface-card`).

| Fil                        | Indhold                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `weight-chart.ts`          | Komponenten: inputs og geometrien som `computed()`.         |
| `weight-chart.html`        | Hoved, SVG og fodnote – eller en tom tilstand uden punkter. |
| `weight-chart.scss`        | Kortet, typografien og kurvens farver.                      |
| `weight-chart-geometry.ts` | Ren funktion: punkter (kg + tid) + målvægt → paths.         |
| `*.spec.ts`                | Låser paths, skalering og den tomme geometri.               |

## Geometri

`computeWeightChartGeometry(points, goalKg)` er designets `linePath` / `areaPath` /
`goalLineY`. Kurven ligger i `viewBox="0 0 320 110"`. x er **tid**: 0 er intervallets start og
320 er nu – fodnotens "-3 uger" … "I dag" – og hver vejning står på sin dato (`position` fra
`WeightLogService.seriesFor()`), så huller og tempo kan ses. Designet fordelte sine 12
demo-punkter jævnt; med rigtige vejninger ville det tegne en vejning for 5 dage siden ved "-1 uge".
Fladen lukkes ned under første og sidste vejning, og endeprikken står ved den nyeste.
y-skalaen spænder fra den laveste til den højeste værdi – **inklusive mållinjen** – med 0,5 kg
luft i hver ende. De nederste 10 enheder er luft, så endeprikken ikke skæres af.

Under to punkter giver en tom geometri, og komponenten viser en tom tilstand i stedet for SVG'en:
"Ingen vægtdata endnu." uden vejninger, og "Din kurve vises, når du har vejet dig igen." efter den
første. Ændringen i hovedet er grå (`muted`), indtil intervallet har to vejninger at sammenligne.

## Beslutninger

- **Kurvens højde (110 px) bindes fra TypeScript** som `--weight-chart-plot-height`, fordi det
  er SVG'ens egen geometri. Bredden er 100 %, så kurven strækkes som i designet.
- **Gradientens id er fast** (`weight-chart-area`). Der er præcis ét grafkort på skærmen;
  skal komponenten bruges flere gange samtidig, skal id'et gøres unikt pr. instans.
- Gradientens stop-farver sættes med CSS (`stop-color` / `stop-opacity`), så de følger tokens.
