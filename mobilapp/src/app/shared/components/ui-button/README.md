# UiButton

Designets `.pill`-knap. Komponenten sidder som attribut på et native `<button>` eller `<a>`,
så `type`, `disabled` og `routerLink` virker, som de plejer.

```html
<button app-ui-button type="submit" [loading]="saving()">Log ind</button>
<a app-ui-button variant="outline" size="md" [routerLink]="path">Annuller</a>
```

| Input     | Standard    | Betydning                                                                                                                                                                                                    |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `variant` | `'primary'` | `primary` orange pille med uppercase · `outline` gennemsigtig med kant · `surface` kant + glas-fyld · `outline-danger` kant + rød tekst · `ghost` orange tekst · `danger` rød bund · `subtle` sekundær tekst |
| `size`    | `'xl'`      | `xl` 56 px · `lg` 52 px · `md` 48 px · `sm` 44 px — samme trin som `--size-control-*`                                                                                                                        |
| `shape`   | `'pill'`    | `pill` fuld radius · `rounded` 14 px (fotoarkets sekundære knapper)                                                                                                                                          |
| `block`   | `false`     | Fylder hele bredden                                                                                                                                                                                          |
| `loading` | `false`     | Viser en `UiSpinner` før indholdet, sætter `aria-busy`/`aria-disabled` og blokerer klik                                                                                                                      |

## Beslutninger

- Størrelsesnavnene følger `--size-control-*`, så `size="lg"` og `--size-control-lg` er den
  samme højde. Standarden er `xl` (56 px), designets almindelige CTA.
- Afviger designet fra skalaen på én skærm, sætter forælderen `--ui-button-min-height` på
  knappen i stedet for at kopiere hele knappens styling.

- `loading` sætter **ikke** native `disabled` (det ville kollidere med forbrugerens egen
  `[disabled]`-binding). Klik stoppes i stedet i komponenten, og tilstanden annonceres med
  `aria-disabled`.
- `UiSpinner` tegner normalt i `--color-accent`, som ville forsvinde på den orange knap. Knappen
  bruger derfor spinnerens `tone="current"`, så ringen følger knappens tekstfarve.
- Host-styling står som `:host(.ui-button--primary) { … }`. Under Angulars emulerede
  encapsulation ville `.ui-button--primary { … }` blive scoped til indholdet og aldrig ramme
  selve knappen.
