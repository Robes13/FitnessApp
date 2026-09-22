# UiCard

Standardkortet fra designet: glas-fyld (`--color-surface`), blød hairline og 16 px radius –
`mixins.surface-card`. Bruges til dagskortet og ugekortet på Hjem, kalorie-ringen og
makrokortene på Mad, grafkortet på Vægt og samlingskortene.

```html
<app-ui-card>…</app-ui-card>
<app-ui-card padding="lg" tone="accent">Til mål …</app-ui-card>
<app-ui-card padding="none" tone="soft">…</app-ui-card>
```

| Input     | Standard    | Betydning                                                                                                                |
| --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `padding` | `'md'`      | `none` 0 · `sm` 12 px · `md` 16/18 px · `lg` 20 px                                                                       |
| `tone`    | `'surface'` | `surface` glas · `soft` lidt kraftigere glas (`--color-surface-2`) · `accent` orange gradient med mørk tekst ("Til mål") |

## Beslutninger

- Kortet er kun en flade: intet header/footer-API. Indholdet projiceres, og featuren
  strukturerer det selv, så kortet ikke låser layoutet.
- `accent`-kortet bruger `--color-text-on-accent`, så tekst og ikoner arver den mørke farve.
- Styling ligger på værten (`:host`), så et kort kan lægges direkte i et grid eller en
  flex-kolonne uden et ekstra wrapper-element.
