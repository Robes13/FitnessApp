# MealPicker

Designets 2×2-gitter med Morgenmad · Frokost · Aftensmad · Snacks: "Log som spist under" på
opskriftsskærmen – måltidstypen, samlingen logges under (spec 3.2).

```html
<app-meal-picker [(value)]="meal" [ariaLabel]="'collections.recipePage.logUnder' | translate" />
```

| Input       | Betydning                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `value`     | `model<MealId>` – det valgte måltid (tovejsbinding).                                                   |
| `ariaLabel` | Gruppens (oversatte) navn, ellers "Vælg måltid". Knapperne er `role="radio"` i en `role="radiogroup"`. |

**Tastatur:** gruppen følger radiogruppe-mønstret. Kun det valgte måltid er i
tab-rækkefølgen (roving tabindex), og piletasterne flytter valget og fokus. Gitteret har to
kolonner, så venstre/højre rykker én plads og op/ned en hel række (±2); der wrappes rundt.

Ligger i featuren og ikke i `shared/`, fordi den kender `MEALS` og kun bruges her. Skal en
anden feature bruge den, flyttes den til `shared/components/`.
