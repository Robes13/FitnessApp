# BarcodeScanner

Stregkodescanneren (use casen "logge en madvare med stregkode"). På telefonen åbner den
kameraet; i browseren – og efter en mislykket scanning – kan stregkodens tal indtastes.
Stregkoden slås op i brugerens eget katalog og ellers i Open Food Facts, og
varen vises med kcal og makroer, måltidet og en mængde, der kan justeres, før den logges. Kendes
varen ikke, siger overlayet det, og "Opret varen selv" fører til den fulde formular for en egen
vare med stregkoden (3.1-6a → 3.0), så næste scanning finder den.

```html
<app-barcode-scanner
  [open]="scannerOpen()"
  [kcalRemaining]="kcalRemaining()"
  [(meal)]="meal"
  [busy]="saving()"
  [error]="saveError()"
  (closed)="scannerOpen.set(false)"
  (found)="log($event)"
  (manualRequested)="openSearch()"
  (noBarcodeRequested)="openNewFood($event)"
/>
```

## Inputs og outputs

| Input           | Standard | Betydning                                                                                                                                                                                          |
| --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`          | –        | Krævet. Forælderen ejer tilstanden                                                                                                                                                                 |
| `kcalRemaining` | `null`   | Dagens mål minus det spiste. Bruges til verdict-boksen; `null` skjuler den                                                                                                                         |
| `meal`          | `null`   | Måltidet varen logges under (`model`, tovejs). Sat viser resultat-arket måltids-chips, så måltidet ses og kan skiftes før "Tilføj" (3.2); `null` skjuler dem (en samlings kladde har intet måltid) |
| `autoStart`     | `true`   | Åbn kameraet med det samme (kun native). Ellers trykker brugeren "Scan stregkode"                                                                                                                  |
| `busy`          | `false`  | Forælderen gemmer `found`-varen: "Tilføj" viser spinner, og resultat-arket kan ikke forlades                                                                                                       |
| `error`         | `null`   | Hvorfor forælderen ikke kunne gemme varen – vises over resultat-arkets knapper                                                                                                                     |

| Output               | Betydning                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `closed`             | Scanneren skal lukkes. **Udsendes til sidst på alle veje ud** – også efter `manualRequested` og `noBarcodeRequested` og når kameraet annulleres – undtagen `found` |
| `found`              | Den fundne vare skaleret til den valgte mængde, `quantity` fx `'150 g'`, id `off-<stregkode>`. Scanneren bliver åben, til forælderen lukker den                    |
| `manualRequested`    | "Indtast manuelt i stedet" (søg i varerne)                                                                                                                         |
| `noBarcodeRequested` | Forælderen åbner vælgerens "Ny egen vare". Efter "ikke fundet" ("Opret varen selv") med stregkoden, som varen gemmes med; "Varen har ingen stregkode" giver `null` |

Fordi `closed` kommer sidst, behøver forælderen kun én handler, der sætter `open` til `false`.
**`found` er undtagelsen:** resultatet bliver stående, til forælderen har gemt varen og selv
sætter `open` til `false` – pessimistisk som "Tilføj mad". Fejler gemningen (fx uden net), viser
`error` beskeden over knapperne, og vare, mængde og måltid står der stadig til et nyt tryk på
"Tilføj"; `busy` blokerer imens et dobbelt tryk og "Scan igen". "Scan igen" lader beskeden blive
tilbage, så næste vare ikke viser den gamle fejl. Mad-siden logger varen med
`FoodLogService.add()`, der opretter den som brugerens egen vare (`ensureFood`); "Ny samling"
lægger den i kladden og lukker straks.

## Forløb

1. **Åbn.** Native og `autoStart`: `BarcodeScannerService.scan()` åbner kameraet med det
   samme, og hintet er _Læser stregkode…_. I browseren er `canScan` `false`: der vises et felt
   til stregkoden og hintet _Kameraet kan ikke bruges her …_ (browseren, eller en app uden kamera-plugin, fx iOS indtil ML Kit er med).
2. **Kameraets udfald** (`BarcodeScanOutcome`):
   - `scanned` → opslag (trin 3).
   - `cancelled` → scanneren lukker uden at logge noget (8b).
   - `permission-denied` → dansk forklaring + "Åbn indstillinger" (3a).
   - `unreadable` → _Vi kunne ikke læse stregkoden …_ + "Scan stregkode" igen (5a).
   - `module-installing` → Googles stregkodemodul hentes; brugeren prøver igen om lidt.
   - `module-unavailable` → modulet mangler stadig efter den ene anmodning (eller Google afviste
     den): _Kamerascanneren kan ikke bruges på telefonen lige nu. Indtast stregkodens tal
     herunder._ uden "Scan stregkode" – ingen uendelig "prøv igen". Se `BarcodeScannerService`.
     Stregkodefeltet står under beskeden i alle tilfælde, så tallene altid kan indtastes.
3. **Opslag.** Indtastet stregkode valideres først (8–14 cifre, fejlen vises efter "Slå op").
   Under opslaget vises `UiSpinner` og _Slår varen op…_, og feltet skjules. Hvert opslag
   tæller én scanning (`recordScan()`) til "10 scans"-badget. `BarcodeFlowService.lookup` spørger
   først brugerens katalog (`FoodLogService.foods`, en vare med samme stregkode – scannet før
   eller oprettet efter "ikke fundet") og først derefter Open Food Facts. En katalogvare vises
   pr. 100 g (100 ml med en ml-serving) og logges under sit eget id; en vare pr. stk/portion
   vises som sin syntetiske portion på 100 g (`// ponytail:`).
4. **Resultat** (`ProductLookupResult`):
   - `found` → resultat-arket.
   - `not-found` → _Varen blev ikke fundet._ (rød) over "Indtast manuelt i stedet" og "Opret
     varen selv" (6a, i stedet for "Varen har ingen stregkode" – varen har jo en), som sender
     stregkoden med; stregkodefeltet og "Scan stregkode" står der stadig.
   - `error` → _Vi kunne ikke slå varen op …_ + "Prøv igen", der slår samme stregkode op igen.
5. "Scan igen" – og luk på resultat-arket – går tilbage til overlayet; native åbnes kameraet
   igen efter 300 ms.

Alle timere, opslaget og et igangværende kamera-svar annulleres, når `open` bliver `false`,
når komponenten destrueres og ved hver genstart (`scanRun` gør et sent kamerasvar ugyldigt).

## Resultat-arket

`UiSheet` (lag `top`, `scrollable`) med varens navn som titel, `brand · mængde`, "Hvilket
måltid?" med de fire måltids-chips (når `meal` er sat), "Hvor meget tog du?" med mængdefliser, et felt
"Mængde (g)" (eller "Mængde (ml)" for væsker), fire nøgletal og verdict-boksen. Måltidet er
forælderens (Mad-sidens `addMeal`, det samme som arket "Tilføj mad" står på), så varen aldrig
logges under et skjult måltid. Indholdet scroller inden i arket, så "Scan igen" / "Tilføj"
altid står synligt – også med tastaturet åbent over mængdefeltet og med stor systemskrift.

- Open Food Facts' tal er pr. 100 g (100 ml for væsker; mængder vises da i ml). Fliserne er pakkens portion (`Portion`, fx `50 g · 200 kcal`)
  når den kendes i gram, og forvalgene 50 / 100 / 200 g (`SCAN_AMOUNT_PRESETS_GRAMS`, uden det
  forvalg der er lig portionen). Startmængden er portionen, ellers 100 g.
- Feltet er en typed reactive form (1–5000 g, eller ml for en væske). Ændres mængden,
  genberegnes tal og verdict med `BarcodeFlowService.scale` (8a). Ugyldig mængde viser
  `UiFormError` i varens enhed ligesom feltets label (`'… mellem 1 og 5.000 ml.'` for en væske),
  skjuler tallene og slår "Tilføj" fra. Det samme loft pr. logning som i vælgeren (`exceedsFoodLogCap`, spec
  3.2-5a) gælder også her: Open Food Facts' tal er ikke til at stole på (fx kJ skrevet som
  kcal), så over 9999 kcal eller 999 g af en makro viser `shared.foodPicker.amountTooLarge` og
  slår "Tilføj" fra – ellers svarer API'et 500.

| Tilfælde                      | Tone                         | Tekst (ordret fra designet)                                                                 |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| Varen sender dagen over målet | rød (`negative-soft-strong`) | _Den skubber dig N kcal over dagens mål. Overvej en halv, eller gem den til efter træning._ |
| Protein ≥ 15 g                | grøn (`positive-tint`)       | _God proteinkilde – P g protein. Du har N kcal tilbage bagefter._                           |
| Ellers                        | neutral (`surface-2`)        | _Passer fint ind. N kcal tilbage bagefter._                                                 |

`buildScanVerdict(t, kcalRemaining, item)` er eksporteret og testet for sig; teksterne ligger
under `shared.barcodeScanner.verdict*` i oversættelsesfilerne. N, fliserne, nøgletallene og
grænsen i mængdefejlen skrives med `formatInteger` (`'2.245 kcal'`, `'… mellem 1 og 5.000 g.'`).

## Beslutninger

- **Pluginets færdige `scan()`-UI** frem for et eget kameralag (`startScan()`): det kræver
  ingen gennemsigtig WebView og ingen skjulte elementer og er det mest robuste. Overlayet
  ligger bag kameraet og viser status, når det lukker.
- **Annullér lukker scanneren.** Brugeren har selv lukket kameraet og forventer at komme
  tilbage dertil, hvor scanningen startede – ikke til et mørkt mellemlag.
- **Mængde i gram** i stedet for designets "Halv / 1 bar": de rigtige varer er ikke alle
  proteinbarer, og Open Food Facts giver tal pr. 100 g.
- **Stregkodefeltet findes også native**, så en stregkode, kameraet ikke kan læse, eller et
  afslået kamera ikke blokerer brugeren.
- **Kameraoverlayet er altid mørkt** (`--color-background-scanner`), og luk-knappen bruger
  `UiIconButton`s `translucent`-tone.
- **Ingen tegnet søger.** Kameraet er pluginets egen native UI, så WebView'en viser aldrig et
  kamerabillede; en tegnet ramme med scan-linje ville kun være pynt. Overlayet viser hint,
  spinner (under opslaget), knapperne og stregkodefeltet.
- **Mængdefliserne er egne knapper**, ikke `UiChip`: de har to linjer (etiket + kcal).
- **Ingen "Ukendt vare"-formular** (plan-v2 P12): dens fire felter var en ringere udgave af
  vælgerens "Ny egen vare" (3.0), som "Opret varen selv" åbner – med stregkoden, så varen
  gemmes med den.
- Escape lukker overlayet, når det ligger øverst; ligger et ark ovenpå, håndterer `UiSheet`
  Escape.
- **Tab holdes inde i overlayet** (`role="dialog" aria-modal="true"`) med `FOCUSABLE_SELECTOR`
  fra `UiSheet`; ligger et ark ovenpå, ejer `UiSheet` fælden.
- **Fokus gives tilbage** til elementet, der åbnede scanneren, når den lukker eller
  destrueres. Tog overlayet aldrig fokus, rører komponenten ikke fokus.
- **Domænelogikken ligger i core.** Komponenten injicerer kun facaden `BarcodeFlowService`
  (`core/services/barcode-flow/barcode-flow.ts`), der samler kamera, opslag, scanningstælleren og
  skalering. Komponenten holder selv kun præsentation og
  formular-state (skærm, status, timere, annullering af et sent svar). Det er den
  mindste ændring, der overholder "shared har ingen forretningslogik": at sende alt ind som
  inputs ville flytte hele scan → opslag → resultat-flowet ud i begge forældre (Mad og
  Samlinger) og duplikere det. Komponenten logger og gemmer intet selv – det gør forælderen
  via outputs.
