# UiTabBar

Bundnavigationen: en pille med lige brede celler og en orange knop, der glider bag den
aktive celle. Den aktive celle viser kun ikonet i mørk farve; de andre viser ikon + 9 px label.

```html
<app-ui-tab-bar [items]="TAB_BAR_ITEMS" />
```

```ts
export const TAB_BAR_ITEMS: readonly TabBarItem[] = [
  { label: 'Mad', icon: 'tab-food', path: APP_PATH.FOOD },
  // …
];
```

| Input   | Standard   | Betydning                                                   |
| ------- | ---------- | ----------------------------------------------------------- |
| `items` | (påkrævet) | `readonly TabBarItem[]` – `{ label, icon: IconName, path }` |

`activeIndex` er offentligt (−1 når ingen sti matcher), så shell'en kan læse det, hvis den
får brug for det.

## Beslutninger

- **Placering:** `position: absolute` med `--layout-tab-bar-inset` i siderne og
  `--layout-tab-bar-offset` i bunden. Den positioneres derfor i forhold til
  shell'en/app-roden (der er `position: relative`), ikke viewporten, og respekterer
  `--layout-max-width`.
- **Afstand til bunden:** `--layout-tab-bar-offset` lægger baren lige over home-indikatoren
  (safe area minus `--space-3`), som iOS' egne tab-barer, så den følger telefonens runde
  hjørner. Uden safe area (web, ældre telefoner) er afstanden `--space-2`. Sidernes spacer
  (`--layout-tab-bar-clearance`) er afledt af offset og `--layout-tab-bar-height`, så
  indholdet altid kan scrolles fri af baren.
- **Aktiv celle** kommer fra `RouterLinkActive` (`{ exact: false }`, `aria-current="page"`).
  **Knoppens position** beregnes af `Router.isActive(path, { paths: 'subset', … })` efter hver
  `NavigationEnd` og bindes som `--tab-count`/`--tab-index`, så `/samling/<id>` stadig
  fremhæver Samling. Matcher ingen sti (fx `/profil`), skjules knoppen.
- Sider med tab bar slutter med en spacer på `--layout-tab-bar-clearance`, så indholdet kan
  scrolles fri af baren.
