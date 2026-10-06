# UiProgressRing

Cirkulær fremdriftsring: dagsringene på Hjem, kalorieringen på Mad, trin-tælleren i
opret-flowet og buen om præstations-badges.

## Geometri

Ringen er en SVG med `viewBox = 0 0 d d`, hvor `d` er `diameter`. Begge cirkler har

- centrum `d / 2`
- radius `r = (d − strokeWidth) / 2`, så stregen holder sig inden for viewBox
- omkreds `C = 2πr`

Fyldcirklen får `stroke-dasharray = C` og `stroke-dashoffset = C × (1 − value)`. Ved
`value = 0` er hele stregen skjult, ved `value = 1` er ringen lukket. `value` klemmes altid fast
til 0..1. SVG'en roteres −90°, så fyldet starter i toppen og løber med uret.

Radius er altså afledt af diameter og stregtykkelse – der er ikke et separat `radius`-input.
Designet tegner sine ringe med håndskrevne radier, der ikke altid fylder boksen (fx r 16 i
en 40-boks, så der er plads til den orange markeringsring udenom). Vil man ramme designets
dasharray præcist, vælges `diameter = 2 · r + strokeWidth`:

| Design                                | Ring                          | Omkreds |
| ------------------------------------- | ----------------------------- | ------- |
| Opret-trin: r 21, streg 3 i 48-boks   | `diameter 45, strokeWidth 3`  | 132     |
| Ugedagsringe: r 16, streg 4 i 40-boks | `diameter 36, strokeWidth 4`  | 100,5   |
| Kaloriering: r 42, streg 10 i 100-box | `diameter 94, strokeWidth 10` | 264     |
| Badge-bue: r 26, streg 3 i 56-boks    | `diameter 55, strokeWidth 3`  | 163,4   |

Kalorieringen vises 84 px bred i designet (viewBox 100 skaleret ned); i appen angives
diameteren direkte i px, så `diameter 84, strokeWidth 8` giver samme udtryk.

## Størrelse

Diameteren bindes som CSS-variablen `--ring-size` på host-elementet
(`[style.--ring-size.px]`), som stylesheetet bruger til `width`/`height`. Det er den ene
sanktionerede brug af dynamisk geometri – ingen px i SCSS'en.

## Indhold i midten

Alt mellem taggene projiceres i et absolut centreret lag over SVG'en:

```html
<app-ui-progress-ring [value]="0.6" [diameter]="84" [strokeWidth]="10">
  <span>1.240</span>
</app-ui-progress-ring>
```

## Inputs

| Input         | Standard   | Betydning                                                                               |
| ------------- | ---------- | --------------------------------------------------------------------------------------- |
| `value`       | `0`        | Andel 0..1                                                                              |
| `diameter`    | `48`       | Ydre diameter i px                                                                      |
| `strokeWidth` | `4`        | Stregtykkelse i px                                                                      |
| `tone`        | `'accent'` | Fyldets farve (`ProgressRingTone`: `accent`, `positive`, `negative`, `info`, `neutral`) |
| `trackTone`   | `'line'`   | Skinne: `line` (hairline), `neutral` (grå 30 %), `none` (ingen)                         |
| `animated`    | `true`     | Animerer `stroke-dashoffset` ved ændring                                                |

Host-elementet har `role="progressbar"` med `aria-valuenow` i procent.
