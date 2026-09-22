# UiEmptyState

Tom tilstand: en stiplet boks med en kort forklarende tekst (13 px sekundær). Bruges, når en
liste ikke har noget at vise – "Ingen varer matcher din søgning.", "Ingen poster endnu.",
"Du har ingen samlinger med varer endnu …".

```html
<app-ui-empty-state message="Ingen poster endnu." />
```

| Input     | Standard    | Betydning                                                             |
| --------- | ----------- | --------------------------------------------------------------------- |
| `message` | (påkrævet)  | Teksten, ordret fra designet                                          |
| `tone`    | `'default'` | `default` · `subtle` lysere stiplet kant og dæmpet tekst (inde i ark) |
| `size`    | `'md'`      | `md` 13 px · `sm` 12 px                                               |

## Beslutninger

- Kun tekst. Designets tomme tilstande har ingen ikon eller knap; handlingen (fx "Opret en
  vare selv") står som en separat række under boksen i den feature, der ejer listen.
- `text-wrap: pretty` undgår enkeltord på sidste linje i de længere tekster.
