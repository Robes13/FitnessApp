# WeightStep

Signup-trin 4 (`weight`, designets `s2`): vægten.

- Overskrift `Hvad er din vægt?` med orange `vægt?`, underteksten
  `Din vægt i dag – du kan altid rette den senere.`
- Vægten som 92 px orange display-tal med `kg` ved siden af. Formatet er designets
  `weightText`: én decimal med dansk komma, hele kilo uden `,0`.
- To knapper (`−` / `+`) ændrer vægten ét kilo ad gangen inden for `WEIGHT_MIN_KG` …
  `WEIGHT_MAX_KG` (30–300 kg), og hintet `Træk i skalaen nedenfor, eller brug − og +.`
  forklarer begge veje.
- `app-figure` med håndvægt bliver bredere, når vægten stiger; pandebåndets farve
  følger det valgte køn (`bandToneForGender` fra `shared/components/figure`).
- `app-ui-ruler` (30–300 kg, 8 px pr. streg) ligger ud til begge skærmkanter og er
  tovejsbundet til `SignupStateService.weightKg`.
- Tal, knapper, figur og lineal er den fælles [`MeasureStage`](../../measure-stage/README.md);
  trinnet leverer overskrift, undertekst og hintet under knapperne.

## Beslutninger

- Designets faste px-bredde på hintet er oversat til en relativ værdi (`12.5em` = 150 px
  ved 12 px tekst), så der ikke står px-litteraler i komponentens SCSS.
