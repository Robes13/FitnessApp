# ShellLayout

`app-shell-layout` – rammen om tab-skærmene: en `<router-outlet>` til den aktive side og
`<app-ui-tab-bar [items]="TAB_BAR_ITEMS">` nederst.

| Fil                    | Indhold                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `shell-layout.ts`      | Komponenten. Beregner `showTabBar` som signal ud fra routerens snapshot-træ.                           |
| `shell-layout.html`    | Outlet + tab bar i `@if (showTabBar())`.                                                               |
| `shell-layout.scss`    | `:host { position: relative; height: 100%; overflow: hidden }`.                                        |
| `shell-layout.spec.ts` | Tester at baren skjules på ruter med `hideTabBar` og mens tastaturet er åbent, og vises igen bagefter. |

## Sådan skjules tab baren

Baren skjules også, mens skærmtastaturet er åbent (`KeyboardService.isOpen`), som i native iOS-apps: tastaturet tager dens plads, og skærmen over beholder hele højden til det fokuserede felt.

Efter hver `NavigationEnd` følges `ActivatedRouteSnapshot.firstChild` til den dybeste rute, og
dennes `data[ROUTE_DATA.HIDE_TAB_BAR]` afgør, om baren tegnes. Snapshot-træet bruges frem for
`ActivatedRoute.firstChild`, fordi det er komplet, allerede når shell'en oprettes –
`initialValue` på `toSignal` giver derfor det rigtige svar på første render uden et ekstra
navigationsevent. Nøglen ligger i `core/constants/route-data.ts`, så featuren, der ejer ruten
(opskriftsiden under Samling), kan skrive `data: { [ROUTE_DATA.HIDE_TAB_BAR]: true }` uden at
importere fra shell'en.

## Layout

Host-elementet (`.shell-layout`) er `position: relative` og fylder app-roden i højden, så
sidernes `height: 100%` virker, og `UiTabBar` (`position: absolute`) lægger sig i bunden af
shell'en – og dermed inden for `--layout-max-width`. Reglen står som `:host { … }`, fordi en
`.shell-layout { … }`-regel under emuleret encapsulation kun ville ramme indholdet.
