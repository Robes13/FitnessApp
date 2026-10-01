# UiSwitch

Skydeknap 48×28 med 22 px knop (Lys tilstand, Notifikationer på Profil). Tændt = orange
bund; slukket = `--color-track`.

```html
<app-ui-switch [checked]="isLight()" (checkedChange)="setLight($event)" ariaLabel="Lys tilstand" />
```

| Input       | Standard   | Betydning                                         |
| ----------- | ---------- | ------------------------------------------------- |
| `checked`   | `false`    | Stillingen, kontakten viser                       |
| `ariaLabel` | (påkrævet) | Kontaktens navn – den har ingen synlig label selv |
| `disabled`  | `false`    |                                                   |

Kontakten er **styret** (controlled): et tryk sender kun `checkedChange` med den nye værdi, og
den skifter først, når forælderen sender en ny `checked`. Ellers kunne en gemning, der afvises,
før næste render (fx en tilladelse, der nægtes med det samme), efterlade den i den forkerte
stilling, fordi forælderens værdi aldrig ændrede sig.

Den indre `<button>` bærer `role="switch"`, `aria-checked` og `aria-label`. Knoppens afstand
til kanten beregnes af tokens (`(--size-switch-h − --size-thumb) / 2`), så ingen px står i
stylesheetet.
