# UiProgressBar

Vandret fremdriftsbjælke: designets 4/6 px skinne med farvet fyld. Bruges til dagskortets
kalorieandel, makro-bjælkerne på Mad, styrkemåleren under "Ny adgangskode" og bjælken på det
orange "Til mål"-kort.

```html
<app-ui-progress-bar [value]="eaten() / target()" />
<app-ui-progress-bar [value]="strength().percent / 100" [tone]="strength().tone" thickness="thin" />
<app-ui-progress-bar [value]="goalPct()" tone="inverse" />
```

| Input       | Standard    | Betydning                                                                                                                                              |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `value`     | `0`         | Andel 0..1; klemmes fast, ugyldige tal (NaN, ∞) bliver 0                                                                                               |
| `tone`      | `'accent'`  | `Tone` (`accent`, `positive`, `negative`, `info`, `selected`, `neutral`, `secondary`, `muted`, `warning`) eller `inverse` (mørk bjælke på orange kort) |
| `thickness` | `'regular'` | `regular` 6 px · `thin` 4 px                                                                                                                           |

Værten har `role="progressbar"` med `aria-valuemin/max/now` i procent. `percent` er offentligt
(0–100, afrundet), og `clampFraction()` er eksporteret og testet for sig.

## Beslutninger

- Bredden animeres (`--duration-slow`), så tal, der ændrer sig, glider i stedet for at hoppe.
- `inverse` findes, fordi det orange kort ikke kan bruge den orange accent: både skinne og fyld
  tegnes i mørke toner af `--color-text-inverse`.
- Skinnen er `--color-surface-hover` som i designets `rgba(255,255,255,.1)`.
