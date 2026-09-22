# TrainingDurationStep

Signup-trinnet `training-duration` (`app-training-duration-step`): "Hvor længe **ad gangen?**".

## Indhold

- Minuttallet (10–180) med enheden "min", en pille med længden (`Kort og effektivt` …
  `Udholdenhedspas`) og hjælpeteksten "Træk i skalaen nedenfor."
- Scenen: et stopur, hvis ring fyldes med minutterne (omkreds 364,4 – `stroke-dashoffset`
  bindes), og hvis viser drejer hurtigere, jo længere passet er (4,5 − minutter/40 sekunder,
  mindst 1,2 s). Under uret står figuren skaleret til 62 %.
- Linealen (`app-ui-ruler`) fra 10 til 180 minutter i spring på 5.

## Beslutninger

- Figuren er `FigureBody` (`shaded`, humør 0,5) uden kinder – stopur-scenen i designet tegner
  kun øjne og smil. Kinderne slås fra med `expression = { cheekRadius: 0 }`.
- Rotationerne i scenen bruger procent af `viewBox`'en (`transform-box: view-box`), så der
  ikke står SVG-koordinater i stylesheetet.

Figurens koordinater opdateres samlet gennem `animatedFigure`, så kropsdele og afledte
rekvisitter deler samme frame ved hurtige inputskift. Se fælles figur-dokumentation for
afbrydelse, tempo og reduceret bevægelse.
