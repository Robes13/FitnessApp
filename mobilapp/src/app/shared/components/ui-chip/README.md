# UiChip

Filter- og valg-chip: Alle · Vejning · Mad, måltidsvalg, vægt-intervaller og ikon-gitteret i
"Ny samling". Sidder som attribut på et native `<button>` (`type="button"` sættes automatisk);
indholdet projiceres, så en chip kan indeholde ikon + tekst.

```html
@for (filter of filters(); track filter.id) {
<button app-ui-chip size="sm" [selected]="filter.id === active()" (click)="pick(filter.id)">
  {{ filter.label }}
</button>
}
```

| Input      | Standard | Betydning                                                                                                                                    |
| ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `selected` | `false`  | Orange kant, orange skær (`--color-accent-soft`) og orange tekst; ellers hairline, gennemsigtig og sekundær tekst. Spejles i `aria-pressed`. |
| `size`     | `'md'`   | `md` 40 px / 13 px tekst (vægt-intervaller) · `sm` 36 px / 12 px tekst (filtre, måltider)                                                    |
| `filled`   | `false`  | Uvalgt chip får glas-fyld (`--color-surface`) i stedet for gennemsigtig bund                                                                 |

Bredde og `flex` styres af forælderen: designet bruger både `flex: none` (scrollende rækker)
og `flex: 1` (lige brede måltidsvalg).
