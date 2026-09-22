# HeightStep

Signup-trin 5 (`height`, designets `s3`): højden.

- Overskrift `Hvor høj er du?` med orange `høj`. Underteksten er designets `heightQuip`
  og nævner den vægt, brugeren lige har valgt:
  `Sammen med dine 75 kg bruger vi den til dit kaloriebehov.`
- Højden som 92 px orange display-tal med `cm`, og to knapper (`−` / `+`), der flytter
  én centimeter ad gangen inden for `HEIGHT_MIN_CM` … `HEIGHT_MAX_CM` (55–250 cm).
- BMI-blokken under knapperne: `Højde og vægt giver` / tallet / `i BMI` /
  `Bruges til dit kaloriebehov`. Tallet kommer fra `NutritionCalculator.bmi()`.
- `app-figure` med `showCeiling`: den stiplede loftslinje og lampen toner ind fra
  212 cm, og hovedet dukker fra 230 cm — begge tærskler ligger i
  `computeFigureGeometry` i `shared/components/figure`.
- `app-ui-ruler` (55–250 cm) ud til begge skærmkanter, tovejsbundet til
  `SignupStateService.heightCm`.

## Beslutninger

- BMI vises med dansk komma (`23,7`) via `formatDecimal`, hvor prototypen skrev
  punktum. Resten af appen bruger komma.
- Designets faste px-bredde på figuren er oversat til `66 %` af indholdsbredden, så
  der ikke står px-litteraler i SCSS'en.
