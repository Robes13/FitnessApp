# Figure

Figuren (maskotten) fra designet: den blå figur med orange sko og pandebånd, der optræder på
opret-trinnene (vægt, højde, aktivitet, træning, intensitet, notifikationer, opsummering) og på
Vægt-siden. Mappen indeholder geometrien, kroppen som genbrugelig SVG-del og en færdig SVG.

## Filer

| Fil                   | Indhold                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `figure-geometry.ts`  | `FigureGeometry` + `computeFigureGeometry(weightKg, heightCm, mood)` – eksakt port af designets `figure(w, h, mood)`.                      |
| `figure-body.ts`      | `FigureBody` (`g[app-figure-body]`) – kroppen som attribut-komponent på et SVG `<g>`. `FigureExpression`, `FigureBandTone`.                |
| `figure-band-tone.ts` | `bandToneForGender(gender)` – designets `bandColor`: kvinde → pink, andet → hvidt, ellers orange. Deles af alle skærme, der viser figuren. |
| `figure.ts`           | `Figure` (`app-figure`) – færdig SVG (`viewBox 0 0 200 300`) med krop og valgfrit loft/lampe.                                              |
| `index.ts`            | Barrel: `Figure`, `FigureBody`, `computeFigureGeometry`, typerne.                                                                          |

Importér fra `shared/components/figure` (den ene sanktionerede barrel i `shared`).

## Geometri

`computeFigureGeometry` regner alle mål i SVG-enheder for en `viewBox="0 0 200 300"`: gulvet
ligger ved y ≈ 290, figuren er centreret om x = 100.

- **Vægt** styrer kroppens bredde (46–190) og dermed ben-afstand, bælte og skygge. Fra 180 kg
  åbner munden sig (`mouthRx/Ry`, `tongueRx/Ry`), smilet forsvinder (`smileOp`), og brynene
  vises og drejer (`browOp`, `browRot`).
- **Højde** styrer ben og torso. Fra 212 cm vises loftet (`ceilOp` 0 → 1), fra 230 cm dukker
  figuren sig (`headRot`, `lampRot`), og hovedet klemmes ned under loftet.
- **Humør** (−1..1) styrer smilet og hvor højt højre arm løfter håndvægten (`lift`).

Tallene er designets egne tuningkonstanter. `figure-geometry.spec.ts` låser outputtet med en
tabel af referenceværdier, der er **genereret ved at køre den originale `figure()` fra
`logic.js` i node** – ret aldrig tabellen i hånden.

## FigureBody

```html
<svg viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
  <g app-figure-body [geometry]="geometry()" bandTone="pink" showDumbbell />
</svg>
```

Komponenten sidder som attribut på et `<g>`, så scener kan tegne rekvisitter (kage, klokke,
badevægt, sved, konfetti) før og efter kroppen i samme SVG. Templaten bruger `svg:`-præfiksede
elementer, så Angular opretter dem i SVG-navnerummet.

Tegnerækkefølgen er designets: skygge → ben → sko → arme → krop → bælte → (håndvægt) → hoved
(hovedet er en `<g>`, der drejer med `headRot`).

| Input                          | Standard   | Betydning                                                                                                              |
| ------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `geometry`                     | påkrævet   | `FigureGeometry`                                                                                                       |
| `bandTone`                     | `'accent'` | Pandebånd: `accent`, `pink` (kvinde), `white` (andet), `positive`, `negative`, `muted`, `accent-strong`, `accent-deep` |
| `showDumbbell`                 | `false`    | Håndvægt i højre hånd                                                                                                  |
| `showLeftArm` / `showRightArm` | `true`     | Slå en arm fra, når scenen tegner sin egen animerede arm                                                               |
| `showHead`                     | `true`     | Slå hovedet fra (fx når scenen tegner hoved med hat)                                                                   |
| `showShadow`                   | `true`     | Skyggeellipsen under figuren                                                                                           |
| `shaded`                       | `false`    | Dybdeskygge som i træningsscenerne: venstre ben/arm/sko mørkere, højre arm lysere                                      |
| `animated`                     | `true`     | Designets `transition: all .35s ease` på hver del                                                                      |
| `expression`                   | `{}`       | `Partial<FigureExpression>` – overskriver ansigtet felt for felt                                                       |

`FigureExpression` dækker smil-opacitet, åben mund/tunge, bryn (rotation + opacitet), kinder
(`cheekTone: accent | accent-soft | negative | negative-strong`, `cheekRadius`), pupilforskydning
(`pupilOffsetX/Y` – figuren kigger til siden på Vægt-siden) og `eyesClosed` (to buer i stedet
for øjne, notifikations-trinnets "Nej tak"). Alt, der ikke sættes, kommer fra geometrien via
`defaultFigureExpression()`.

Kinder i designet har flere alfa-toner (`.45`, `.5`, `.6`, `.75`, `.9`); de er samlet til de fire
toner ovenfor: `accent-soft` (`--color-figure-cheek-soft`, 50 %) dækker `.45`/`.5` – ingen
intensitet valgt eller "mildt" – og `accent` (75 %) er standarden.

## Figure

```html
<app-figure [weightKg]="weight()" [heightCm]="height()" showDumbbell showCeiling />
```

Færdig SVG med `role="img"` og `aria-label` (standard `Figur`, designets tekst). Værten er
`display: block`; forælderen sætter bredde/højde (designet: `flex: 1; max-width: 215px`).
`showCeiling` tegner loftlinje, lampesnor og lampe fra højdetrinnet. De er altid i DOM'en, men
har `opacity = ceilOp`, så de kan fade ind ved 212 cm som i designet.

## Farver

Alle farver er tokens via BEM-klasser i `figure-body.scss`: `--color-figure`, `-dark`,
`-light`, `-belt`, `-face`, `-pupil`, `-mouth`, `-shoe`, `-shoe-dark`, `-cheek`, `-cheek-soft`,
`-shadow`, `-dumbbell`,
`-dumbbell-cap`, `-band-pink`, `-band-white` samt `--color-accent*`, `--color-positive`,
`--color-negative`, `--color-text-muted` til pandebånd og tunge. Røde kinder bruges via
`color-mix` af `--color-negative`. Der er ingen hex-værdier i komponenten.
