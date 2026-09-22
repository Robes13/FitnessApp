# WeightPage

`app-weight-page` – fanen Vægt (`/vaegt`).

| Fil                   | Indhold                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `weight-page.ts`      | Siden: udstiller `WeightViewService` og holder de to kortlivede animationer. |
| `weight-page.html`    | Skærmens opbygning.                                                          |
| `weight-page.scss`    | Layout og typografi; `:host` er sidens rod (`page-screen`).                  |
| `weight-page.spec.ts` | Røgtest: opbygning, −/+, gem, intervalchips og listen.                       |

## Opbygning

1. Overskrift "Registrér **vægt**" og "Sidst vejet …" til højre.
2. Kladdevægten som stort orange tal (mindre trin fra 100 kg) med nøgletallene
   "Siden sidst" og "Til mål" under sig – og badevægt-scenen til højre.
3. Linealen (`UiRuler`, 30–300 kg i trin på 0,1) med −/+ knapper på enderne.
4. "Gem vejning", der kvitterer med "Gemt ✓" i 1,4 s.
5. Grafkortet, og **under det** intervalchipsene 1 uge / 4 uger / 3 mdr.
6. "Seneste vejninger" og til sidst en spacer, så indholdet kan scrolles fri af tab baren.

## Tilstand

Siden holder kun to kortlivede signals, fordi de er ren animation:

- `saved` – knappens kvittering, nulstilles efter 1,4 s.
- `lookDirection` – figurens blik følger den retning, vægten blev ændret i, i 0,9 s.

Begge timere ryddes i `DestroyRef.onDestroy`, så en hurtig tab-skift ikke efterlader dem.
Alt andet er afledt i `WeightViewService`.

## Bemærk

Skærmen har ingen tekstfelter, så der er ingen reactive form. Vægten vælges udelukkende med
linealen og −/+ knapperne, som klemmer værdien fast mellem 30 og 300 kg.
