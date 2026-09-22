# WeightEditSheet

`app-weight-edit-sheet` – "Ret **vejning**": ret vægten på en registreret vejning eller slet den.
Åbnes ved tryk på en række i "Seneste vejninger".

| Fil                      | Indhold                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `weight-edit-sheet.ts`   | Komponenten – input `row`, outputs `saved(kg)`, `removed`, `closed`. |
| `weight-edit-sheet.html` | `UiSheet` med tidspunkt, stort tal, `WeightRulerInput` og knapper.   |
| `weight-edit-sheet.scss` | Typografi og knapstakken i footeren.                                 |

## Adfærd

- Arket er åbent, så længe `row` ikke er `null`. Forælderen (`WeightPage` via
  `WeightViewService`) ejer, hvilken vejning der rettes, og udfører gem/slet.
- Vægten rettes med den samme lineal og −/+ (0,1 kg) som på siden. Kladden er et
  `linkedSignal`, der nulstilles til vejningens vægt, hver gang en ny vejning åbnes.
- **Slet kræver bekræftelse:** "Slet" skifter footeren til "Ja, slet vejning" / "Annuller" og
  viser en rød advarsel. Bekræftelsestrinnet nulstilles også, når arket åbnes igen.
- Luk-knap, scrim og Escape lukker uden at gemme (`closed`).
