# UiPageHeader

Sidehoved til undersider uden tab bar-fokus: rund tilbage-knap til venstre, centreret
uppercase-titel og en højre plads til en handling. Bruges på Opskrift ("Opskrift") og Profil
("Profil").

```html
<app-ui-page-header title="Profil" (back)="goHome()" />

<app-ui-page-header title="Opskrift" backIcon="close" backLabel="Luk" (back)="close()">
  <button headerAction app-ui-icon-button size="sm" aria-label="Del">…</button>
</app-ui-page-header>
```

| Input       | Standard         | Betydning                                |
| ----------- | ---------------- | ---------------------------------------- |
| `title`     | (påkrævet)       | Titlen, vist som 12 px uppercase caption |
| `backIcon`  | `'chevron-left'` | `chevron-left` eller `close`             |
| `backLabel` | `'Tilbage'`      | `aria-label` på tilbage-knappen          |
| `hideBack`  | `false`          | Skjul tilbage-knappen (pladsen bevares)  |

| Output | Betydning                    |
| ------ | ---------------------------- |
| `back` | Tilbage-knappen blev trykket |

Slot: `[headerAction]` til højre. Er den tom, fylder pladsen alligevel 44 px, så titlen står
centreret.

## Beslutninger

- Komponenten lægger selv sidens vandrette padding på (`--layout-page-padding-x`), fordi den
  står **uden for** sidens scroll-område og skal flugte med indholdet.
- Navigationen ejes af siden: komponenten udsender kun `back`; siden vælger, om det er
  `router.navigate` eller "luk ark".
- Titlen er en `<h1>`, så hver underside har præcis én sideoverskrift.
