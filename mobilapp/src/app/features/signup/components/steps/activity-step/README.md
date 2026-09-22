# ActivityStep

Signup-trinnet `activity` (`app-activity-step`): "Hvor mange **skridt?**".

## Indhold

- Skridttallet (0–50.000) med designets talhop pr. tusinde (`numtickA`/`numtickB` skifter,
  så animationen kan starte forfra) og konfetti, når man passerer 10.000.
- Aktivitetspillen (`NutritionCalculator.activityLevelFor`) og de to omregninger
  "≈ x km til fods" / "≈ y kcal ekstra" (`stepsToKm` / `stepsToKcal`).
- Scenen: figuren går mod venstre over rullende gulvstreger. Tempoet følger tallet, og
  tærsklerne er designets: pause under 400, hund fra 8.000, fartstreger fra 9.000, sved fra
  12.000 (dråbe nummer to over 17.000) og medalje fra 25.000. Under 2.500 skridt krydsfader
  gå-scenen over i sofa-scenen med tv.
- Linealen (`app-ui-ruler`) med én streg pr. 100 skridt, 5,6 px pr. streg og etiket hver
  2.000 (`0`, `2k`, `4k` …). Den går ud til begge skærmkanter, som i designet.

## Beslutninger

- **Gå-figuren er tegnet her, ikke med `FigureBody`.** Ben og arme skal rotere hver for sig
  om hofte og skulder (`strideA/B`, `swingA/B`), og `FigureBody` tegner kroppen som én
  gruppe. De øvrige trin bruger `FigureBody`.
- Scenernes tempi, forskydninger og konfettiens drift bindes fra TypeScript som
  CSS-variabler og `animation-duration`, fordi de afhænger af skridttallet.
- Fartstregerne fra 9.000 skridt findes som `speedOp`/`speedY1`/`speedY2` i designets logik,
  men er aldrig tegnet i prototypens skabelon. Her er de to neutrale streger bag figuren.
- Tekstspalternes bredde er sat i `ch` frem for designets px, så der ikke står layout-px i
  stylesheetet.
