# UiFormError

Hint- eller fejllinje under et felt. Reserverer altid 16 px (`--space-4`), så layoutet ikke
hopper, når teksten kommer og går – præcis som designets `min-height:16px`.

```html
<app-ui-form-error [message]="passwordHint()" />
<app-ui-form-error message="Sendt igen" tone="positive" />
```

| Input     | Standard   | Betydning                                                                |
| --------- | ---------- | ------------------------------------------------------------------------ |
| `message` | `null`     | Teksten; `null`/`undefined`/`''` viser ingenting men holder højden       |
| `tone`    | `'accent'` | `accent` orange hint · `negative` rød fejl · `positive` grøn bekræftelse |

Host-elementet har `role="status"` og `aria-live="polite"`, så skærmlæsere læser nye
beskeder op. Lodret afstand (designets varierende `padding: 6px 4px 10px`) sættes af den
side, der bruger komponenten.
