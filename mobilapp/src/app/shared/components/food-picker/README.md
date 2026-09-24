# FoodPicker

Vare-vælgeren fra designets "Tilføj mad" (linje 1405–1511): **søg** → **portion**, eller
**ny egen vare**. Komponenten ejer trinnet og fortæller forælderen om skift med `stepChange`,
så arket kan skjule måltidsvalg og faner uden for søgetrinnet.

```html
<app-food-picker
  [editItem]="editing()"
  [ctaVerb]="editing() ? 'Gem' : 'Tilføj'"
  [saveAndLogLabel]="'Gem og log under ' + mealLabel().toLowerCase()"
  (picked)="log($event)"
  (customFoodCreated)="saveCustom($event)"
  (scanRequested)="openScanner()"
  (stepChange)="pickerStep.set($event)"
  (cancelled)="close()"
/>
```

## Trin

| Trin       | Indhold                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`   | Søgefelt ("Søg mad, f.eks. havregryn") + orange scan-knap. Resultater fra `FoodSearchService` (egne varer først med grøn "Egen vare"-pille, tom søgning viser de første seks). Spinner mens der søges, `UiEmptyState` uden match: "Ingen varer matcher din søgning." efter en søgning, "Du har ingen varer endnu. …" før. Nederst "Opret "…" som ny vare" / "Opret en vare selv".                                                           |
| `new-food` | "Ny egen vare" med typed reactive form: Navn, Portion (mængde + enhed g/stk/port.), Kalorier, Protein (g) og en fold-ud med Kulhydrat/Fedt. Primær knap (`saveAndLogLabel`) er slået fra, indtil der er navn og kalorier > 0. Findes navnet allerede blandt brugerens egne varer (trimmet, uden forskel på store/små bogstaver), vises fejlen med `app-ui-form-error`, og begge knapper er slået fra. "Gem uden at logge" gemmer kun.       |
| `portion`  | Varens navn og "Standard: 250 g · 380 kcal", −/+ omkring et tal, der også kan trækkes til siden (8 px pr. trin), hurtigvalg (½ · 1× · 2× · 3× for gram, 1–4 for styk), fire fliser med skalerede makroer og knappen `${ctaVerb} ${mængde} ${enhed}`. Redigeres en egen vare (`editBaseItem`), vises også felter til kcal/protein/kulhydrat/fedt pr. varens standardportion; ugyldige tal vises med `app-ui-form-error` og slår knappen fra. |

## Inputs

| Input             | Standard   | Betydning                                                                                               |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| `initialQuery`    | `''`       | Forudfyldt søgetekst                                                                                    |
| `startStep`       | `'search'` | `search` eller `new-food` (scannerens "Varen har ingen stregkode" åbner direkte i formularen)           |
| `editItem`        | `null`     | Redigér en logget vare: starter i `portion` med varens egen mængde som basis                            |
| `editBaseItem`    | `null`     | Den egne vare, `editItem` blev logget fra. Bliver basis for skaleringen og gør kcal/makroer redigerbare |
| `ctaVerb`         | `'Tilføj'` | `Tilføj` eller `Gem` i portionsknappen                                                                  |
| `saveAndLogLabel` | (påkrævet) | Primær knap i "Ny egen vare", fx `'Gem og log under morgenmad'` – forælderen kender måltidet            |
| `showScan`        | `true`     | Vis scan-knappen ved søgefeltet                                                                         |

## Outputs

| Output              | Betydning                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `picked`            | `{ item, amount, unit }`. `item` har makroer skaleret med `NutritionCalculator.scaleMacros` og `quantity` = `` `${amount} ${unit}` ``, så den kan logges direkte |
| `customFoodCreated` | Ny egen vare (`isCustom: true`). Udsendes både for "Gem uden at logge" og "Gem og log …" – i det sidste tilfælde følger `picked` med samme vare lige efter       |
| `customFoodEdited`  | Den egne vare med rettede kcal/makroer (standardportion). Udsendes lige før `picked`, kun når `editBaseItem` er en egen vare                                     |
| `scanRequested`     | Scan-knappen blev trykket                                                                                                                                        |
| `stepChange`        | `'search' \| 'new-food' \| 'portion'` – kun ved skift, ikke for starttrinnet                                                                                     |
| `cancelled`         | Tilbage fra portionstrinnet, når der ikke er en søgning at vende tilbage til (`editItem` sat). Uden `editItem` går tilbage-knappen selv til søgningen            |

## Beslutninger

- **Core-services:** `FoodSearchService` og `NutritionCalculator` som i spec'en, og
  `FoodLogService.hasCustomFoodNamed` til dubletkontrollen af navne. Derudover
  `newId()`, fordi `FoodItem.id` er påkrævet, og den nye vare skal kunne sendes som en
  hel `FoodItem`. Id'et (præfiks `CUSTOM_FOOD_ID_PREFIX`) er varens endelige id: forælderen
  gemmer den med `FoodLogService.addCustomFood(input, item.id)`, så en vare fra "Gem og log …"
  logges med samme id som den gemte egne vare og senere kan redigeres (`editBaseItem`).
  Dubletreglen håndhæves også i `FoodLogService` (`DuplicateCustomFoodNameError`); vælgeren
  tjekker blot på forhånd for at vise fejlen i formularen.
- **Søgningen** er en `toObservable(request) → switchMap(search)`-kæde, så en ny søgetekst
  afbryder den forrige. Efter en gemt egen vare søges der igen med tom tekst, så den nye
  vare står øverst, selv om teksten var tom i forvejen (intern `searchVersion`).
- **Mængden** er en `linkedSignal` med varen som kilde: hver ny vare nulstiller til dens
  standardportion. `null` betyder, at feltet er tømt under indtastning; knappen er slået
  fra, indtil der står et tal over 0 (designet ville ellers logge "0 g").
- **Træk-til-justér** sidder på boksen omkring tallet, ikke på selve feltet (som i designet),
  så almindelig indtastning stadig virker. `touch-action: none` + pointer capture holder
  gestussen, selv om fingeren forlader boksen.
- **Egen vare** følger designets `ownFood`: navn og kalorier kræves; tom mængde bliver `1`,
  tomme makroer `0`. `Validators.required` godtager mellemrum, så navnet har en egen
  `notBlank`-validator.
- **Genbrug:** `UiTextInput`, `UiIconButton`, `UiIcon`, `UiChip`, `UiButton`, `UiSpinner` og
  `UiEmptyState`. Enheds- og portionschips er `UiChip` (pille) – designet tegner enhederne
  med 14 px radius, men samme farvelogik. Tallet i portionstrinnet er et nøgent
  display-skrift-felt som i designet og derfor ikke `UiTextInput`.
- Talfeltet er `--size-portion-field` (designets 96 px) bredt, og plus-cirklen i
  resultatrækkerne `--size-control-3xs` (28 px). Den stiplede ikonboks i "Opret …"-rækken er
  `--size-control-2xs` (36 px) mod designets 34 px.

Protein, kulhydrat og fedt må være tomme (0), men kan ikke være negative eller
ikke-endelige tal. Ugyldige værdier vises med en formularfejl og blokerer begge
gemmeknapper samt direkte formularindsendelse.
