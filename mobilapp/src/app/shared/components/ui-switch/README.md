# UiSwitch

Skydeknap 48×28 med 22 px knop (Lys tilstand, Notifikationer på Profil). Tændt = orange
bund; slukket = `--color-track`.

```html
<app-ui-switch [(checked)]="isLight" ariaLabel="Lys tilstand" />
```

| Input       | Standard   | Betydning                                         |
| ----------- | ---------- | ------------------------------------------------- |
| `checked`   | `false`    | Two-way `model`                                   |
| `ariaLabel` | (påkrævet) | Kontaktens navn – den har ingen synlig label selv |
| `disabled`  | `false`    |                                                   |

Den indre `<button>` bærer `role="switch"`, `aria-checked` og `aria-label`. Knoppens afstand
til kanten beregnes af tokens (`(--size-switch-h − --size-thumb) / 2`), så ingen px står i
stylesheetet.
