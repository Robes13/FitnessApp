# UiSegmentedControl

Segmenteret valg med radiogruppe-semantik. To varianter fra designet:

- **`pill`** – 52 px høj, uppercase, en orange knop glider bag det valgte segment (Ja tak /
  Nej tak på notifikationstrinnet). Knoppen er først synlig, når der er et valg.
- **`compact`** – 36 px faner i en pille, den aktive fane er fyldt orange (Varer / Samlinger i
  tilføj-arket).

```html
<app-ui-segmented-control
  variant="pill"
  [options]="choices"
  [(value)]="notifications"
  ariaLabel="Notifikationer"
/>
```

```ts
readonly choices: readonly SegmentOption<boolean>[] = [
  { value: true, label: 'Ja tak' },
  { value: false, label: 'Nej tak' },
];
readonly notifications = signal<boolean | null>(null);
```

| Input       | Standard   | Betydning                                            |
| ----------- | ---------- | ---------------------------------------------------- |
| `options`   | (påkrævet) | `readonly SegmentOption<T>[]` med `{ value, label }` |
| `value`     | `null`     | Two-way `model<T \| null>`; `null` = intet valgt     |
| `variant`   | `'pill'`   | `pill` · `compact`                                   |
| `ariaLabel` | `null`     | Gruppens navn                                        |

`T` er begrænset til `string | number | boolean`, så `track option.value` er entydigt.

## Beslutninger

- **Knoppen er ren CSS.** Komponenten binder `--segment-count` og `--segment-index` som
  CSS-variabler; stylesheetet regner `left`/`width` ud fra dem og den indre padding. Det
  generaliserer designets `calc(50% − 6px)` til vilkårligt mange segmenter.
- **Native radioknapper.** Hvert segment er en `<label>` med en `<input type="radio">`, der
  deler `name` (`ui-segmented-control-N`) med de andre i gruppen. Browseren giver dermed
  piletaster (med wrap-around), roving tab-stop og checked-tilstand uden eget tastaturcode.
  Inputtet er `appearance: none` og ligger usynligt over hele segmentet, så det både er
  trykfladen og bærer fokusringen. `aria-checked`/`tabindex` sættes ikke selv.
