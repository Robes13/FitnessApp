# BarcodeScanner

Designets stregkodescanner (skærmene "Scan", "Scan-resultat" og "Ukendt vare"). Der er intet
kamera – `BarcodeScannerService` i `core` spiller scanner og svarer skiftevis med demo-varen og
"ukendt". Komponenten tegner søgefeltet, kører linje-animationen og viser resultatet.

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
| `autoStart`     | `true`   | Start scanningen automatisk ved åbning. Ellers kalder forælderen `startScan()`             |

| Output               | Betydning                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `closed`             | Scanneren skal lukkes. **Udsendes til sidst på alle veje ud** – også efter de fire outputs herunder                           |
| `found`              | `FoodItem` skaleret til den valgte portion ("Halv" / "1 bar"), `quantity` fx `'28 g'`                                         |
| `customSaved`        | Ukendt vare gemt fra formularen: navn, portion (standard `'1 portion'`), kcal, protein; kulhydrat og fedt 0; `isCustom: true` |
| `manualRequested`    | "Indtast manuelt i stedet"                                                                                                    |
| `noBarcodeRequested` | "Varen har ingen stregkode"                                                                                                   |

Fordi `closed` altid kommer sidst, behøver forælderen kun én handler, der sætter `open` til
`false`. `found`/`customSaved` skal ikke selv lukke noget.

## Forløb (designets `runScan`)

1. Overlayet åbner med linjen i hvile (50 %) og hintet _Hold stregkoden inden for rammen – vi
   scanner automatisk_.
2. Efter 500 ms starter scanningen: hintet skifter til _Læser stregkode…_, linjen springer til
   88 % og glider til 14 % (700 ms) og 62 % (1500 ms) med en 900 ms transition.
3. `BarcodeScannerService.scan()` svarer ved 2300 ms (`SCAN_DELAY_MS`): fund åbner
   resultat-arket, ellers åbnes "Ukendt vare".
4. "Scan igen" – og luk på begge ark – går tilbage til søgefeltet og starter en ny scanning efter
   300 ms.

Alle timere og abonnementet ryddes, når `open` bliver `false`, når komponenten destrueres og
ved hver genstart. Åbnes scanneren igen, begynder forløbet forfra.

## Resultat-arket

`UiSheet` (lag `top`) med varens navn som titel, `brand · portion`, "Hvor meget tog du?" med to
portionsfliser (designets `scanPortions`), fire nøgletal og verdict-boksen:

| Tilfælde                      | Tone                         | Tekst (ordret fra designet)                                                                 |
| ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------- |
| Varen sender dagen over målet | rød (`negative-soft-strong`) | _Den skubber dig N kcal over dagens mål. Overvej en halv, eller gem den til efter træning._ |
| Protein ≥ 15 g                | grøn (`positive-tint`)       | _God proteinkilde – P g protein. Du har N kcal tilbage bagefter._                           |
| Ellers                        | neutral (`surface-2`)        | _Passer fint ind. N kcal tilbage bagefter._                                                 |

Portionen skaleres med `NutritionCalculator.parseQuantity` + `scaleMacros`, så `55 g` × ½ bliver
`28 g` / 105 kcal. Verdictens `buildScanVerdict` er eksporteret og testet for sig.

## Beslutninger

- **Genstart efter luk på et ark.** I designet efterlader "Luk"/"Scan igen" på resultatet
  søgefeltet i hvile uden at scanne igen, mens "Scan igen" på "Ukendt vare" starter forfra efter
  300 ms. Hintet lover "vi scanner automatisk", så begge ark genstarter scanningen her.
- **Proteinlinjen bruger varens gram** i stedet for designets hårdkodede "20 g". For demo-varen
  ved 1× giver det præcis designets tekst; for en halv bar (10 g) rammes reglen alligevel ikke.
- **"Ukendt vare"-badgen** ligger i `UiSheet`s `[sheetTitle]`-slot, som tegnes i titlens plads,
  når arket ikke har en `title` – så står den til venstre for luk-knappen som i designet.
- **Kameraoverlayet er altid mørkt.** Designet bruger `#020617` uafhængigt af tema; det er
  tokenet `--color-background-scanner` (konstant i begge temaer). Stregerne er `--color-white`,
  og luk-knappen bruger `UiIconButton`s `translucent`-tone.
- **Rammens geometri** (260×170 px m.m.) findes ikke som tokens og bindes fra `SCAN_FRAME` i
  TypeScript som `--scan-*`-variabler. Linjens 900 ms transition er tokenet
  `--duration-scan-sweep`, og dens orange skær `--shadow-accent-line-glow`.
- **Portionsfliserne er egne knapper**, ikke `UiChip`: de er 52 px høje, 12 px afrundede
  rektangler med to linjer (etiket + gram), som chippen ikke kan tegne.
- **Formularen** er en typed reactive form (`name`, `quantity`, `kcal`, `protein`) med
  `UiTextInput`. "Gem og tilføj" er slået fra, indtil der er et navn og kcal > 0 – præcis
  designets `nfDisabled`. Der er ingen fejltekst i designet, så `UiFormError` bruges ikke.
- Escape lukker overlayet, når det ligger øverst; ligger et ark ovenpå, håndterer `UiSheet`
  Escape, og scanneren lader det være.
