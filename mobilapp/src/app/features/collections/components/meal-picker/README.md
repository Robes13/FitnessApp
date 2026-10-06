# MealPicker

Designets 2×2-gitter med Morgenmad · Frokost · Aftensmad · Snacks: "Log som spist under" på
opskriftsskærmen – måltidstypen, samlingen logges under (spec 3.2).

```html
<app-meal-picker [(value)]="meal" [ariaLabel]="'collections.recipePage.logUnder' | translate" />
```

| Input       | Betydning                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| `value`     | `model<MealId>` – det valgte måltid (tovejsbinding).                                                         |
| `ariaLabel` | Gruppens (oversatte) navn, ellers "Vælg måltid". Hvert måltid er en `<label>` med en `<input type="radio">`. |

**Tastatur:** hvert valg er en native radioknap (med samme `name`), så browseren giver
radiogruppens tastatur selv: kun det valgte måltid er i tab-rækkefølgen, og piletasterne flytter
valget og fokus. Radioknappen ligger usynligt oven på sin label og viser fokusringen.

Ligger i featuren og ikke i `shared/`, fordi den kender `MEALS` og kun bruges her. Skal en
anden feature bruge den, flyttes den til `shared/components/`.
