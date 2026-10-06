# ShellLayout

`app-shell-layout` – rammen om tab-skærmene: en `<router-outlet>` til den aktive side og
`<app-ui-tab-bar [items]="tabBarItems()">` nederst – `TAB_BAR_ITEMS` med teksterne oversat til det aktive sprog, så fanerne skifter sprog live.

| Fil                    | Indhold                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `shell-layout.ts`      | Komponenten. Beregner `showTabBar` ud fra `KeyboardService.isOpen`.                                   |
| `shell-layout.html`    | Outlet + tab bar i `@if (showTabBar())`.                                                              |
| `shell-layout.scss`    | `:host { position: relative; height: 100%; overflow: hidden }`.                                       |
| `shell-layout.spec.ts` | Tester outlet og de fem faner, og at baren skjules, mens tastaturet er åbent, og vises igen bagefter. |

## Sådan skjules tab baren

Baren skjules, mens skærmtastaturet er åbent (`KeyboardService.isOpen`), som i native iOS-apps:
tastaturet tager dens plads, og skærmen over beholder hele højden til det fokuserede felt.

Skærme, der slet ikke skal have en tab bar (Profil, opskriften under Samling), ligger uden for
shell'en i `app.routes.ts` og får derfor aldrig baren.

## Layout

Host-elementet (`.shell-layout`) er `position: relative` og fylder app-roden i højden, så
sidernes `height: 100%` virker, og `UiTabBar` (`position: absolute`) lægger sig i bunden af
shell'en – og dermed inden for `--layout-max-width`. Reglen står som `:host { … }`, fordi en
`.shell-layout { … }`-regel under emuleret encapsulation kun ville ramme indholdet.
