# UiIconButton

Designets runde `.circ`-knap: tilbage, luk, −/+, scan, "Opret samling". Komponenten sidder
som attribut på et native `<button>` og har et `<app-ui-icon>` som indhold.

```html
<button app-ui-icon-button size="sm" tone="accent" aria-label="Opret samling" (click)="open()">
  <app-ui-icon name="plus" size="xl" [strokeWidth]="1.9" />
</button>
```

| Input  | Standard    | Betydning                                                                                                                                                                       |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size` | `'xl'`      | `xl` 56 · `lg` 52 · `md` 48 · `sm` 44 · `xs` 40 · `2xs` 36 · `3xs` 28 · `4xs` 26 px                                                                                             |
| `tone` | `'neutral'` | `neutral` glas-fyld · `ghost` helt gennemsigtig · `accent` orange med mørkt ikon · `translucent` mørk 50 % med blur (fotoskærme) · `outline` kun kant · `danger-soft` rødt skær |

Knappen er ikon-only og **skal** have `aria-label` (dansk, fra designet).
