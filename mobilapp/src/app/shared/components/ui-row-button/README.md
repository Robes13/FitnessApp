# UiRowButton

Række med label til venstre og værdi + chevron til højre. Bruges i Profil ("Min plan",
"Konto") og som de kompakte opsummeringsrækker i opret-flowet. Komponenten sidder som
attribut på en `<button>`, så hele rækken er ét klikbart element.

```html
<button
  app-ui-row-button
  label="Mål"
  value="Tabe mig"
  valueTone="accent"
  (click)="edit('goal')"
></button>
<button
  app-ui-row-button
  density="compact"
  label="Vægt"
  value="75 kg"
  [divider]="false"
  (click)="jump('weight')"
></button>
```

| Input       | Standard    | Betydning                                                                               |
| ----------- | ----------- | --------------------------------------------------------------------------------------- |
| `label`     | (påkrævet)  | Tekst til venstre                                                                       |
| `ariaLabel` | `null`      | Erstatter rækkens oplæste navn, fx "Ret vægt" på opsummeringens rækker                  |
| `value`     | `''`        | Tekst til højre (trunkeres med ellipsis)                                                |
| `valueTone` | `'default'` | `default` sekundær · `muted` dæmpet · `accent` orange (fx "Mål" i opsummeringen)        |
| `density`   | `'regular'` | `regular` 14 px padding, 14 px medium label, 13 px værdi · `compact` 44 px, 13 px tekst |
| `chevron`   | `true`      | Chevron til højre for værdien                                                           |
| `divider`   | `true`      | Hairline øverst (rækkerne stables uden mellemrum)                                       |

## Beslutninger

- Labelen fylder højst 65 % af rækken: en lang label (fx samtykkerækken på Profil) brydes over
  flere linjer i stedet for at skubbe værdien ud af rækken. Korte labels mærker det ikke.
- Divideren sidder **øverst** på hver række; den første række i en liste sætter
  `[divider]="false"`, så listen ikke får en streg i toppen.
- `compact` har hover-fyld (`--color-surface-hover`) og blødere divider, som designets
  opsummeringsliste; `regular` har intet hover, fordi rækkerne ligger på et kort.
- Host-styling står som `:host(.ui-row-button--compact) { … }`, fordi kun `:host(…)` rammer
  selve `<button>` under emuleret encapsulation.
