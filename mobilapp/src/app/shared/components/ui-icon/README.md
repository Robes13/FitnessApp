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

- `IconName = CollectionIconName | UiIconName`. Samlingsikonerne er de 30 navne i
  `core/constants/collection-icons.ts` med stier fra designets `colIconDefs`; `UI_ICON_NAMES`
  er chevrons, luk, plus/minus, øje, scan, flueben, blyant, billede, mail, opdater, gentag,
  log ud, pil og de fem tab-ikoner (`tab-*`, designets `tabDefs`).
- `ICON_PATHS: Record<IconName, readonly string[]>` – én streng pr. `<path>`.
- Designets `<rect>`/`<circle>`-elementer (billede, mail, øjets pupil) er skrevet om til
  stier, så komponenten kun har én tegne-vej.
- `icon-registry.spec.ts` sikrer, at alle samlingsikoner og UI-ikoner har stier, og at
  ingen navne mangler eller er dobbelte.
