# NotificationsStep

Signup-trinnet `notifications` (`app-notifications-step`) — designets `sNotif`,
"Et lille **puf** i hverdagen?".

## Valget

`UiSegmentedControl` i `pill`-varianten med **Ja tak** / **Nej tak**. `notifications` er
`null`, indtil brugeren svarer: så er den glidende knop usynlig, og
`SignupStateService.canContinue` er falsk. Teksten under overskriften har tre udgaver — én
pr. tilstand — og dens højde er reserveret, så scenen ikke hopper, når man skifter valg.

## Scenen

Figuren er `FigureBody` med pandebånd efter køn. Resten er trinnets egen SVG:

| Valg       | Klokke                                                    | Figur                                             |
| ---------- | --------------------------------------------------------- | ------------------------------------------------- |
| Ja tak     | Orange, ringer (`ring`-keyframes, 0,9 s) med to lydbølger | Åbne øjne                                         |
| Nej tak    | Grå og overstreget                                        | Lukkede øjne (`expression.eyesClosed`) og "z z z" |
| Ikke valgt | Grå, står stille                                          | Åbne øjne                                         |

Klokkens placering er afledt af hovedets y-position (`headY − 62/60/48/56/40`), præcis som
designets `bellY` / `bellTopY` / `bellWaveY1` / `bellWaveY2` / `zzzY`, så den følger med, når
figuren bliver højere eller bredere. Ophænget sættes med `transform-box: view-box`, så
`transform-origin` regnes i figurens egne viewBox-enheder.

Scenens tempo (0,9 s) er designets eget og hører ikke til `--duration-*`-skalaen.

Figurens koordinater opdateres samlet gennem `animatedFigure`, så kropsdele og afledte
rekvisitter deler samme frame ved hurtige inputskift. Se fælles figur-dokumentation for
afbrydelse, tempo og reduceret bevægelse.
