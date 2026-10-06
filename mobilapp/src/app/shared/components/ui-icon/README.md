# UiIcon

Stroke-ikon på 24×24 viewBox, tegnet med `currentColor`. Alle stier ligger i
`icon-registry.ts`; komponenten tegner ét `<path>` pr. streng.

```html
<app-ui-icon name="chevron-left" size="xl" />
<app-ui-icon [name]="collection.icon" size="3xl" [strokeWidth]="1.9" />
```

| Input         | Standard   | Betydning                                                                                       |
| ------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `name`        | (påkrævet) | `IconName` – et af navnene i registret                                                          |
| `size`        | `'md'`     | `2xs` 12 · `xs` 14 · `sm` 16 · `md` 18 · `lg` 20 · `xl` 22 · `2xl` 24 · `3xl` 26 · `hero` 64 px |
| `strokeWidth` | `2`        | Stregtykkelse i SVG-enheder                                                                     |

Ikonet er altid dekorativt (`aria-hidden="true"`); knappen eller teksten omkring det bærer
betydningen.

## Registret (`icon-registry.ts`)

- `IconName` er navnene i `UI_ICON_NAMES`: chevrons, luk, plus/minus, øje, scan, flueben,
  blyant, billede, mail, gentag, log ud, skraldespand, de fire ikoner, der faktisk vises
  (`utensils`, `bolt`, `moon`, `star` – API'et har intet ikon på en samling, så alle
  samlinger viser `utensils`) og de fem tab-ikoner (`tab-*`, designets `tabDefs`; `tab-food`
  deler sti med `utensils`).
- `ICON_PATHS: Record<IconName, readonly string[]>` – én streng pr. `<path>`.
- Designets `<rect>`/`<circle>`-elementer (billede, mail, øjets pupil) er skrevet om til
  stier, så komponenten kun har én tegne-vej.
- `icon-registry.spec.ts` sikrer, at alle ikoner har stier, og at ingen navne mangler eller
  er dobbelte.
