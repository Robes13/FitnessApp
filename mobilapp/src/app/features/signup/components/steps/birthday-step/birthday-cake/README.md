# BirthdayCake

Fødselsdagsscenen på signup-trinnet `birthday` (designets `sAlder`). Kun brugt af
`BirthdayStep`, derfor ligger den i trinnets egen mappe og ikke i `shared/`.

## Hvad den tegner

- Figuren (`app-figure-body`) med højre arm slået fra — den erstattes af designets
  `cakeArm`, der strækker sig op mod kagen.
- **Festhat** fra 16 år (`hatOpacity`), **tåre** under 16 år (`tearOpacity`,
  `drip`-animationen).
- **Kagen**: 1–3 lag efter alderen (< 20 → 1, < 50 → 2, ellers 3), hvert lag med
  bølget glasur (`cake-geometry.ts` bygger stien), tallerken, oval overflade og
  alderen skrevet på kagen over 40 år.
- **Lysene**: ét pr. år, højst 25, fordelt på op til tre koncentriske ringe
  (kapacitet 12 / 8 / 5). Hver flamme har `flicker` og et blødt `glow` med forskudt
  `animation-delay`, så de ikke blafrer i takt. Lysene sorteres på y, så de forreste
  tegnes sidst.
- Kagen tones ned til 30 % under 16 år og 25 %, når ingen dato er valgt.

## Beslutninger

- Geometrien ligger i `cake-geometry.ts` som rene funktioner og er unit-testet mod
  designets tal.
- De to brune kagefarver findes kun i palette-laget
  (`--color-cake-tier-dark` / `--color-cake-tier`), og lysene har hver sin token
  (`--color-candle-0` … `--color-candle-4`) med designets fem pastelfarver.

Figurens koordinater opdateres samlet gennem `animatedFigure`, så kropsdele og afledte
rekvisitter deler samme frame ved hurtige inputskift. Se fælles figur-dokumentation for
afbrydelse, tempo og reduceret bevægelse.
