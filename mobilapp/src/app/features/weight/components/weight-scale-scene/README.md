# WeightScaleScene

`app-weight-scale-scene` – badevægten med figuren ovenpå (designets `vfig`). Kroppen er
`FigureBody` fra `shared/components/figure`; scenen tegner kun vægten og partiklerne omkring
den.

| Fil                       | Indhold                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `weight-scale-scene.ts`   | Komponenten: inputs og de afledte værdier.                             |
| `weight-scale-scene.html` | SVG'en (`viewBox 0 0 200 300`, bundjusteret).                          |
| `weight-scale-scene.scss` | Farver som tokens; animationernes tempo bindes pr. partikel.           |
| `scale-scene-geometry.ts` | Ren port af designets partikler, toner og mål – uden Angular.          |
| `*.spec.ts`               | Låser geometrien og komponentens reaktion på fremgang og gemt vejning. |

## Inputs

| Input           | Betydning                                                                       |
| --------------- | ------------------------------------------------------------------------------- |
| `weightKg`      | Kladdevægten. Styrer figurens bredde og tallet på vægtens display.              |
| `heightCm`      | Profilens højde. Styrer ben og torso.                                           |
| `progressKg`    | Designets `good`: kilo i den rigtige retning.                                   |
| `saved`         | Lige efter "Gem vejning": figuren hopper 34 enheder op, og fem gnister blinker. |
| `lookDirection` | −1 / 0 / 1 – pupillerne følger den retning, vægten netop blev ændret i.         |

## Sådan reagerer figuren på `progressKg`

| Fremgang   | Reaktion                                      |
| ---------- | --------------------------------------------- |
| −1,5 → 1,5 | Humøret går fra ked af det til glad (mættes). |
| pr. 0,2 kg | Én sveddråbe mere, højst ti.                  |
| voksende   | Vandpytten vokser til 52 × 5 enheder.         |
| ≥ 0,5 kg   | Pandebåndet mørknes (`accent-strong`).        |
| ≥ 1 kg     | Pandebåndet mørknes igen (`accent-deep`).     |
| ≥ 2,5 kg   | Tre dampskyer over hovedet.                   |

## Beslutninger

- **Scenens tegneflade (150 × 236 px) bindes som lokale variabler fra TypeScript**
  (`--weight-scale-scene-width/-height`), fordi det er SVG'ens egen geometri og ikke en
  layoutværdi, der hører hjemme som design token.
- **Sveden ligger uden for figurens `translate(0 -8)`**, så punkterne er flyttet 8 enheder med i
  `scale-scene-geometry.ts` – nøjagtigt som i designet.
- **Vægtens display er `--color-display-dark`** – tokenet for et altid mørkt digitaldisplay,
  som ikke skifter med temaet.
- Designets håndklæde (`towelOp` fra 1,5 kg fremgang) er beregnet i prototypens logik, men
  **tegnes ikke** i dens template. Det er derfor udeladt her.
