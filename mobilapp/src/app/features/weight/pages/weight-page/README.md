# WeightPage

`app-weight-page` – fanen Vægt (`/vaegt`).

| Fil                   | Indhold                                                                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `weight-page.ts`      | Siden: udstiller `WeightViewService`, starter dens handlinger og holder de to kortlivede animationer.                                                                 |
| `weight-page.html`    | Skærmens opbygning, indlæsning/fejl og overskrivningsarket.                                                                                                           |
| `weight-page.scss`    | Layout og typografi; `:host` er sidens rod (`page-screen`).                                                                                                           |
| `weight-page.spec.ts` | Opbygning, startvægt, spinner/"Prøv igen", −/+, gem (fejl, overskriv/annullér, tab-skift undervejs), intervalchips, listen, ret og slet (også fejl efter sletningen). |

## Opbygning

1. Overskrift "Registrér **vægt**" og "Sidst vejet i dag" / "… i går" / "… 18. sep" (ældre
   vejninger med dato, som i sletteadvarslen; uden vejninger: "Startvægt fra registreringen") til
   højre. Mens vejningerne eller profilen indlæses, står der kun en spinner
   under overskriften; fejler en af dem, en besked og "Prøv igen".
2. Kladdevægten som stort orange tal (mindre trin fra 100 kg) med nøgletallene
   "Siden sidst" og "Til mål" under sig – og badevægt-scenen til højre.
3. Linealen (`WeightRulerInput` om `UiRuler`, 30–300 kg i trin på 0,1) med −/+ knapper på enderne.
4. "Gem vejning" (spinner, mens der gemmes), der kvitterer med "Gemt ✓" i 1,4 s, og en fejllinje
   under knappen. Er der allerede vejet i dag, åbner "Overskriv **dagens vejning?**" – et
   `UiSheet` direkte i siden (samme mønster som log ud-arket, ingen egen komponent) uden
   luk-knap: "Ja, overskriv" (spinner) eller "Annuller". Androids tilbageknap er "Annuller"
   (`closeOnEscape`), undtagen mens der gemmes.
5. Grafkortet, og **under det** intervalchipsene 1 uge / 3 uger / 3 mdr.
6. "Seneste vejninger" (højst 3 mdr. tilbage, "Vis alle" folder ud) og til sidst en spacer, så
   indholdet kan scrolles fri af tab baren. Tryk på en række åbner `WeightEditSheet`.

## Tilstand

Siden holder kun to kortlivede signals, fordi de er ren animation:

- `saved` – knappens kvittering, nulstilles efter 1,4 s.
- `lookDirection` – figurens blik følger den retning, vægten blev ændret i, i 0,9 s.

Begge timere ryddes i `DestroyRef.onDestroy`, så en hurtig tab-skift ikke efterlader dem. En
handling, der er i gang, afbrydes ikke af et tab-skift (API'ets svar skal nå storene); kun sidens
kvittering springes over, når siden er væk.
Alt andet er afledt i `WeightViewService`.

## Bemærk

Skærmen har ingen tekstfelter, så der er ingen reactive form. Vægten vælges – også i ret-arket –
udelukkende med linealen og −/+ knapperne, som klemmer værdien fast mellem 30 og 300 kg.
