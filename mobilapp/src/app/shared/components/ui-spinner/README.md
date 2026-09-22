# UiSpinner

Roterende ring med orange top – designets `dcspin`. Bruges alene som loading-tilstand
(søgeresultater, "Logger ind med ny kode…") og inde i `UiButton`, når `loading` er sat.

```html
<app-ui-spinner />
<app-ui-spinner size="lg" ariaLabel="Søger…" />
<app-ui-spinner size="sm" tone="current" />
```

| Input       | Standard      | Betydning                                                                                           |
| ----------- | ------------- | --------------------------------------------------------------------------------------------------- |
| `size`      | `'md'`        | `sm` 16 · `md` 24 · `lg` 44 px (`lg` har tykkere streg)                                             |
| `tone`      | `'accent'`    | `accent` orange top på `--color-track` · `current` ringen følger `currentColor` (knapper)           |
| `ariaLabel` | `'Indlæser…'` | Skærmlæser-tekst. Værten har `role="status"` og `aria-live="polite"`, så teksten læses op ved skift |

## Beslutninger

- **Værten er selv ringen.** Templaten er tom; størrelse, kant og animation ligger på
  host-elementet, så der ikke er et ekstra element at style udefra.
- **`tone="current"`** findes, fordi `UiButton` viser spinneren på den orange primærknap, hvor
  en orange top ville være usynlig. Ringen tegnes da i `currentColor` (25 % skinne, fuld top), så
  den passer til enhver knapvariant uden at knappen skal overskrive spinnerens kanter.
- Varigheden er designets 0,8 s udtrykt som `calc(var(--duration-slower) * 2)`; keyframes
  `dcspin` ligger globalt i `src/styles/_animations.scss`.
