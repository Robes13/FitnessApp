# BarcodeScanner

Stregkodescanneren (use casen "logge en madvare med stregkode"). På telefonen åbner den
kameraet; i browseren – og efter en mislykket scanning – kan stregkodens tal indtastes.
Stregkoden slås op i Open Food Facts, og
varen vises med kcal og makroer og en mængde, der kan justeres, før den logges. Kendes varen
ikke, tilbydes brugeren at oprette den selv.

```html
<app-barcode-scanner
  [open]="scannerOpen()"
  [kcalRemaining]="kcalRemaining()"
  [mealLabel]="mealLabel()"
  (closed)="scannerOpen.set(false)"
  (found)="log($event)"
  (customSaved)="saveCustom($event)"
  (manualRequested)="openSearch()"
  (noBarcodeRequested)="openNewFood()"
/>
```

## Inputs og outputs

| Input           | Standard | Betydning                                                                                  |
| --------------- | -------- | ------------------------------------------------------------------------------------------ |
| `open`          | –        | Krævet. Forælderen ejer tilstanden                                                         |
| `kcalRemaining` | `null`   | Dagens mål minus det spiste. Bruges til verdict-boksen; `null` skjuler den                 |
| `mealLabel`     | `''`     | Måltidet varen lægges under. Indgår ikke i teksterne (designet siger blot "Gem og tilføj") |
| `autoStart`     | `true`   | Åbn kameraet med det samme (kun native). Ellers trykker brugeren "Scan stregkode"          |

| Output               | Betydning                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `closed`             | Scanneren skal lukkes. **Udsendes til sidst på alle veje ud** – også efter de fire outputs herunder og når kameraet annulleres                                |
| `found`              | Den fundne vare skaleret til den valgte mængde, `quantity` fx `'150 g'`, id `off-<stregkode>`                                                                 |
| `customSaved`        | Ukendt vare gemt fra formularen: id med `CUSTOM_FOOD_ID_PREFIX`, navn, portion (standard `'1 portion'`), kcal, protein; kulhydrat og fedt 0; `isCustom: true` |
| `manualRequested`    | "Indtast manuelt i stedet" (søg i varerne)                                                                                                                    |
| `noBarcodeRequested` | "Varen har ingen stregkode"                                                                                                                                   |

Fordi `closed` altid kommer sidst, behøver forælderen kun én handler, der sætter `open` til
`false`. `found`/`customSaved` skal ikke selv lukke noget. Forælderen gemmer `customSaved` som
egen vare med det id, den har fået (`addCustomFood(input, item.id)`).

## Forløb

1. **Åbn.** Native og `autoStart`: `BarcodeScannerService.scan()` åbner kameraet med det
   samme, og hintet er _Læser stregkode…_. I browseren er `canScan` `false`: der vises et felt
   til stregkoden og hintet _Kameraet kan ikke bruges her …_ (browseren, eller en app uden kamera-plugin, fx iOS indtil ML Kit er med).
   Mens skærmtastaturet er åbent (`KeyboardService.isOpen`), får overlayet modifieren `--keyboard`, og kamerarammen skjules. Den er kun dekoration, mens man taster, så hint og felt beholder deres luft på den lave skærm.
2. **Kameraets udfald** (`BarcodeScanOutcome`):
   - `scanned` → opslag (trin 3).
   - `cancelled` → scanneren lukker uden at logge noget (8b).
   - `permission-denied` → dansk forklaring + "Åbn indstillinger" (3a).
   - `unreadable` → _Vi kunne ikke læse stregkoden …_ + "Scan stregkode" igen (5a).
   - `module-installing` → Googles stregkodemodul hentes; brugeren prøver igen om lidt.
     Stregkodefeltet står under beskeden i alle tilfælde, så tallene altid kan indtastes.
3. **Opslag.** Indtastet stregkode valideres først (8–14 cifre, fejlen vises efter "Slå op").
   Under opslaget vises `UiSpinner` og _Slår varen op…_, og feltet skjules. Hvert opslag
   tæller én scanning (`recordScan()`) til "10 scans"-badget.
4. **Resultat** (`ProductLookupResult`):
   - `found` → resultat-arket.
   - `not-found` → "Ukendt vare"-arket (6a).
   - `error` → _Vi kunne ikke slå varen op …_ + "Prøv igen", der slår samme stregkode op igen.
5. "Scan igen" – og luk på begge ark – går tilbage til overlayet; native åbnes kameraet igen
   efter 300 ms.

Alle timere, opslaget og et igangværende kamera-svar annulleres, når `open` bliver `false`,
når komponenten destrueres og ved hver genstart (`scanRun` gør et sent kamerasvar ugyldigt).

## Resultat-arket

`UiSheet` (lag `top`) med varens navn som titel, `brand · mængde`, "Hvor meget tog du?" med
mængdefliser, et felt "Mængde (g)" (eller "Mængde (ml)" for væsker), fire nøgletal og
verdict-boksen.

- Open Food Facts' tal er pr. 100 g (100 ml for væsker; mængder vises da i ml). Fliserne er pakkens portion (`Portion`, fx `50 g · 200 kcal`)
  når den kendes i gram, og forvalgene 50 / 100 / 200 g (`SCAN_AMOUNT_PRESETS_GRAMS`, uden det
  forvalg der er lig portionen). Startmængden er portionen, ellers 100 g.
- Feltet er en typed reactive form (1–5000 g). Ændres mængden, genberegnes tal og verdict med
  `BarcodeFlowService.scale` (8a). Ugyldig mængde viser `UiFormError`, skjuler tallene
  og slår "Tilføj" fra.

| Tilfælde                      | Tone                         | Tekst (ordret fra designet)                                                                 |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| Varen sender dagen over målet | rød (`negative-soft-strong`) | _Den skubber dig N kcal over dagens mål. Overvej en halv, eller gem den til efter træning._ |
| Protein ≥ 15 g                | grøn (`positive-tint`)       | _God proteinkilde – P g protein. Du har N kcal tilbage bagefter._                           |
| Ellers                        | neutral (`surface-2`)        | _Passer fint ind. N kcal tilbage bagefter._                                                 |

`buildScanVerdict` er eksporteret og testet for sig.

## "Ukendt vare"-arket

Designets formular (`name`, `quantity`, `kcal`, `protein`) med stregkoden vist under
teksten. "Gem og tilføj" kræver et navn og kcal > 0, og navnet må ikke være en egen vare i
forvejen: `BarcodeFlowService.isCustomFoodNameTaken()` tjekkes løbende, og _Du har allerede en egen
vare med det navn._ vises med `UiFormError` under feltet, mens knappen er slået fra.

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
- **Kameraoverlayet er altid mørkt** (`--color-background-scanner`). Stregerne er
  `--color-white`, og luk-knappen bruger `UiIconButton`s `translucent`-tone.
- **Rammens geometri** (260×170 px m.m.) findes ikke som tokens og bindes fra `SCAN_FRAME` i
  TypeScript som `--scan-*`-variabler. Linjens 900 ms transition er tokenet
  `--duration-scan-sweep`, og dens orange skær `--shadow-accent-line-glow`. Linjen fejer,
  mens kameraet er åbent og under opslaget.
- **Mængdefliserne er egne knapper**, ikke `UiChip`: de har to linjer (etiket + kcal).
- **"Ukendt vare"-badgen** ligger i `UiSheet`s `[sheetTitle]`-slot.
- Escape lukker overlayet, når det ligger øverst; ligger et ark ovenpå, håndterer `UiSheet`
  Escape.
- **Tab holdes inde i overlayet** (`role="dialog" aria-modal="true"`) med `FOCUSABLE_SELECTOR`
  fra `UiSheet`; ligger et ark ovenpå, ejer `UiSheet` fælden.
- **Fokus gives tilbage** til elementet, der åbnede scanneren, når den lukker eller
  destrueres. Tog overlayet aldrig fokus, rører komponenten ikke fokus.
- **Domænelogikken ligger i core.** Komponenten injicerer kun facaden `BarcodeFlowService`
  (`core/services/barcode-flow.ts`), der samler kamera, opslag, scanningstælleren, skalering,
  navnetjekket og opbygningen af den egne vare. Komponenten holder selv kun præsentation og
  formular-state (skærm, status, scan-linjen, timere, annullering af et sent svar). Det er den
  mindste ændring, der overholder "shared har ingen forretningslogik": at sende alt ind som
  inputs ville flytte hele scan → opslag → resultat-flowet ud i begge forældre (Mad og
  Samlinger) og duplikere det. Komponenten logger og gemmer intet selv – det gør forælderen
  via outputs.
