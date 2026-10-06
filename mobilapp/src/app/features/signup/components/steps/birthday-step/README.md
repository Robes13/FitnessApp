# BirthdayStep

Signup-trin 2 (`birthday`, designets `sAlder`): fødselsdatoen.

- Overskrift `Hvornår har du fødselsdag?` med orange `fødselsdag?`, underteksten
  `Din alder indgår i beregningen af dit kaloriebehov.`
- Fødselsdatoen vælges i et native datofelt (`app-ui-text-input type="date"`, som i
  profilens redigeringsark). `max` er i dag, `min` er den ældste fødselsdag, API'et tager imod
  (`MAX_AGE` år). Feltet er en `FormControl<string>`, hvis værdi skrives i
  `SignupStateService.birthday` (`null`, når feltet er tomt eller ufuldstændigt).
- Nederst alderen som 64 px orange tal med `år` og designets `ageHint`
  (`Vælg din fødselsdato ovenfor.` / `Du skal være mindst {{minAge}} år for at bruge Nutrify.` med
  `MIN_AGE`
  / `Tjek datoen igen.`), ved siden af kagescenen `app-birthday-cake`.

## Filer

| Fil              | Indhold                                            |
| ---------------- | -------------------------------------------------- |
| `birthday-cake/` | Kagescenen (figur, festhat, tåre, kagelag og lys). |

## Beslutninger

- "I dag" kommer fra `NOW`-tokenet, så alderen kan fryses i tests.
