# GenderStep

Signup-trin 3 (`gender`, designets `sKon`): køn som tre valgkort.

- Overskrift `Hvad er dit køn?` med orange `køn?`, underteksten
  `Vi bruger det til at beregne dit kaloriebehov.`
- Kortene kommer fra `GENDERS` i `core/constants/nutrition` (label + beskrivelse er
  designets tekster) og bruger `app-ui-option-card` med `selectionStyle="accent-radio"`,
  så det valgte kort får orange kant, orange tone og udfyldt radio-prik.
- Valget skrives direkte i `SignupStateService.gender`.

## Beslutninger

- Trinnet viser ingen figur. Valget styrer til gengæld figurens pandebånd på de
  følgende trin via `bandToneForGender()` i `shared/components/figure`
  (designets `bandColor`: kvinde → pink, andet → hvid, ellers orange).
