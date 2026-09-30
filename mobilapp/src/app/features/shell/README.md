# Shell

Rammen om tab-skærmene (Mad · Vægt · Hjem · Samling · Historik). Shell'en har ingen egen
skærm – den tegner den aktive side i en `<router-outlet>` og lægger tab baren nederst.

| Fil                                 | Indhold                                                                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `shell.routes.ts`                   | `SHELL_ROUTES`: `ShellLayout` med børnene `'' → hjem`, `hjem`, `mad`, `vaegt`, `samling`, `historik` (alle lazy).                 |
| `shell-navigation.ts`               | `TAB_BAR_ITEMS` (designets `tabDefs` i rækkefølge) med `labelKey` (`shell.tabBar.*`).                                             |
| `pages/shell-layout/shell-layout.*` | `ShellLayout` (`app-shell-layout`): outlet + `<app-ui-tab-bar>`, skjuler baren efter route-data og mens skærmtastaturet er åbent. |

## Beslutninger

- **Tab baren styres af routeren, ikke af state.** `UiTabBar` finder selv den aktive celle ud
  fra URL'en, så shell'en skal kun levere `TAB_BAR_ITEMS`. Profil er ikke en tab (nås via
  avataren på Hjem) og ligger uden for shell'en i `app.routes.ts`, så den har ingen tab bar.
- **Skjul tab baren med route-data.** Designets `navVisible` slukker baren på opskriftsiden.
  Det er oversat til `data: { [ROUTE_DATA.HIDE_TAB_BAR]: true }` på den rute, der skal være
  uden bar. Efter hver `NavigationEnd` følger `ShellLayout` snapshot-træet til den dybeste rute
  og læser dennes `data` – resultatet er et signal, og baren tegnes med `@if`. Nøglen ligger i
  `core/constants/route-data.ts`, så både shell'en og den feature, der ejer ruten, kan
  importere den (en feature må ikke importere fra en anden).
- **Layout.** Host-elementet (`.shell-layout`) er `position: relative; height: 100%;
overflow: hidden`, så siderne kan fylde hele højden (`height: 100%`), og tab baren
  (`position: absolute`) placerer sig i forhold til shell'en – og dermed inden for
  `--layout-max-width`. Reglen står som `:host { … }`: under Angulars emulerede
  encapsulation bliver `.shell-layout { … }` scoped til komponentens _indhold_
  (`.shell-layout[_ngcontent-…]`) og rammer aldrig host-elementet selv.
- Designets glide-animation mellem tabs (`tabDir`) er ikke implementeret.
