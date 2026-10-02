# BirthdayStep

Signup-trin 2 (`birthday`, designets `sAlder`): fødselsdatoen.

- Overskrift `Hvornår har du fødselsdag?` med orange `fødselsdag?`, underteksten
  `Din alder indgår i beregningen af dit kaloriebehov.`
- To piller: **År** med `−` / `+` og et redigerbart 4-cifret felt, og **Måned** med
  `‹` / `›`. Årsfeltet er en `FormControl<string>`: mens man skriver, står cifrene
  råt i feltet, og først ved fire cifre klemmes året fast til 1900 … i år. Lander
  visningen i fremtiden, hoppes der tilbage til indeværende måned.
- Månedsgitteret er altid 42 celler (6 uger, mandag først). Dage fra nabomånederne er
  nedtonet, og fremtidige datoer kan ikke vælges.
- Under gitteret: `Valgt: 16. maj 1998` i orange, eller `Ingen dato valgt endnu`.
- Nederst alderen som 64 px orange tal med `år` og designets `ageHint`
  (`Vælg din fødselsdato ovenfor.` / `Du skal være mindst {{minAge}} år for at bruge Nutrify.` med
  `MIN_AGE`
  / `Tjek datoen igen.`), ved siden af kagescenen `app-birthday-cake`.

## Filer

| Fil                | Indhold                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| `calendar-grid.ts` | Rene funktioner: de 42 celler for en måned og spring mellem år/måneder. |
| `birthday-cake/`   | Kagescenen (figur, festhat, tåre, kagelag og lys).                      |

## Beslutninger

- Kalendervisningen (hvilket år og hvilken måned der vises) er lokal trin-state.
  Kun selve datoen skrives i `SignupStateService.birthday`.
- "I dag" kommer fra `NOW`-tokenet, så alderen kan fryses i tests.
- Dagcellerne er 28 px høje (`--size-control-3xs`); designet bruger 30 px, som der
  ikke findes en token til.
- Årsfeltet er 16 px (`--font-size-xl`), ikke designets 15 px: under 16 px zoomer iOS
  WebView'et ind ved fokus, og zoomet bliver stående resten af oprettelsen.
