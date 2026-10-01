# FoodPicker

Vare-vælgeren fra designets "Tilføj mad" (linje 1405–1511): **søg** → **portion**, eller
**ny egen vare**. Komponenten ejer trinnet og fortæller forælderen om skift med `stepChange`,
så arket kan skjule måltidsvalg og faner uden for søgetrinnet.

```html
<app-food-picker
  [editItem]="editing()"
  [ctaVerb]="editing() ? 'Gem' : 'Tilføj'"
  [saveAndLogLabel]="'Gem og log under ' + mealLabel().toLowerCase()"
  [busy]="saving()"
  (picked)="log($event)"
  (customFoodCreated)="saveCustom($event)"
  (scanRequested)="openScanner()"
  (stepChange)="pickerStep.set($event)"
  (cancelled)="close()"
/>
```

## Trin

| Trin       | Indhold                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search`   | Søgefelt ("Søg mad, f.eks. havregryn") + orange scan-knap. Resultater fra `FoodSearchService` (brugerens katalog med grøn "Egen vare"-pille, tom søgning viser de første seks – søges igen, når kataloget ændrer sig). `UiEmptyState` uden match: "Ingen varer matcher din søgning." efter en søgning, "Du har ingen varer endnu. …" før. Nederst "Opret "…" som ny vare" / "Opret en vare selv".                                                                                                                                                                                                                                                      |
| `new-food` | "Ny egen vare" med typed reactive form: Navn, Portion (mængde + enhed g/stk/port.), Kalorier, Protein (g) og en fold-ud med Kulhydrat/Fedt. Hver fejl står under sit eget felt (se "Grænser"). Knapperne er kun slået fra, mens forælderen gemmer: et tryk på en ugyldig formular gemmer intet, men siger under felterne, hvad der mangler (3.0-7a), og folder Kulhydrat/Fedt ud, hvis fejlen er der. Findes navnet allerede blandt brugerens egne varer (trimmet, uden forskel på store/små bogstaver), står det under Navn. "Gem uden at logge" gemmer kun.                                                                                          |
| `portion`  | Varens navn og "Standard: 250 g · 380 kcal", −/+ omkring et tal, der også kan trækkes til siden (8 px pr. trin), hurtigvalg (½ · 1× · 2× · 3× for gram og ml, 1–4 for styk), fire fliser med skalerede makroer og knappen `${ctaVerb} ${mængde} ${enhed}`. Kun mængden kan ændres (også under redigering, spec 3.3). Bliver én logning for stor, slås knappen fra med _Det er for meget til én logning – del den op._ Makroerne skaleres fra varens madvare i kataloget (API'ets decimaler), når den findes i samme enhed – en logget række eller samlingsvare har allerede afrundede tal – og afrundes kun én gang, så tallene er dem, API'et logger. |

## Inputs

| Input             | Standard   | Betydning                                                                                                                                     |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `initialQuery`    | `''`       | Forudfyldt søgetekst                                                                                                                          |
| `startStep`       | `'search'` | `search` eller `new-food` (scannerens "Varen har ingen stregkode" åbner direkte i formularen)                                                 |
| `barcode`         | `null`     | Stregkoden, scanneren ikke fandt (3.1-6a): den egne vare fra formularen, vælgeren starter på, får den med (ikke en vare fra "Opret …"-rækken) |
| `editItem`        | `null`     | Redigér en logget vare: starter i `portion` med varens egen mængde som basis; kun mængden kan ændres                                          |
| `ctaVerb`         | `'Tilføj'` | `Tilføj` eller `Gem` i portionsknappen (en nøgle – teksten oversættes via `CTA_LABEL_KEY`)                                                    |
| `saveAndLogLabel` | (påkrævet) | Primær knap i "Ny egen vare", fx `'Gem og log under morgenmad'` – forælderen kender måltidet                                                  |
| `saveOnlyLabel`   | `null`     | Sekundær knap i "Ny egen vare" (kun gem); `null` = "Gem uden at logge". Samlingsarket sender sin egen                                         |
| `showScan`        | `true`     | Vis scan-knappen ved søgefeltet                                                                                                               |
| `busy`            | `false`    | Forælderen gemmer: primærknapperne viser spinner, og tryk ignoreres (ingen dobbelte kald)                                                     |

## Outputs

| Output              | Betydning                                                                                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `picked`            | `{ item, amount, unit }`. `item` har makroer skaleret med `NutritionCalculator.scaleMacros` og `quantity` = `` `${amount} ${unit}` ``, så den kan logges direkte. Også "Gem og log …" (en ny egen vare, id `food-…`) – `FoodLogService.add()` opretter den selv |
| `customFoodCreated` | Ny egen vare (`isCustom: true`) fra "Gem uden at logge"                                                                                                                                                                                                         |
| `scanRequested`     | Scan-knappen blev trykket                                                                                                                                                                                                                                       |
| `stepChange`        | `'search' \| 'new-food' \| 'portion'` – kun ved skift, ikke for starttrinnet                                                                                                                                                                                    |
| `cancelled`         | Tilbage fra portionstrinnet, når der ikke er en søgning at vende tilbage til (`editItem` sat). Uden `editItem` går tilbage-knappen selv til søgningen                                                                                                           |

## Beslutninger

- **Core-services:** `FoodSearchService` og `NutritionCalculator` som i spec'en, og
  `FoodLogService.hasCustomFoodNamed` til dubletkontrollen af navne. Derudover
  `newId()`, fordi `FoodItem.id` er påkrævet, og den nye vare skal kunne sendes som en
  hel `FoodItem`. Id'et (præfiks `CUSTOM_FOOD_ID_PREFIX`) er midlertidigt: API'et giver varen
  dens rigtige id, når den gemmes. "Gem og log …" udsender kun `picked`, så forælderens
  `FoodLogService.add()` opretter varen, før den logges – ingen kapløb mellem to kald.
  Dubletreglen håndhæves af API'et (409 → `DuplicateCustomFoodNameError`); vælgeren tjekker
  blot på forhånd for at vise fejlen i formularen.
- **Trinnet bliver stående efter `picked`.** Begge forældre (Mad-arket og "Ny samling")
  lukker vælgeren, når valget er gemt, og `busy` dækker ventetiden. Fejler gemningen, står
  formularen eller portionen der stadig med brugerens tal. "Gem uden at logge" bliver også på
  formularen, til varen er i kataloget med sin enhed (fejlede dens serving, vises den som
  `100 g`, og samme tryk heler den), og går så tilbage til en tom søgning, hvor varen står.
  Et navn, vælgeren lige har sendt, tæller ikke som taget, så længe formularen er uændret – blev
  varen oprettet, men fejlede logningen, kan samme tryk prøves igen (`ensureFood` /
  `addCustomFood` genbruger varen ud fra navnet). Ændres formularen bagefter, er navnet taget:
  varen findes allerede med de første tal, og de nye ville ellers blive logget med dem.
- **Søgeresultaterne** viser katalogets tal afrundet (`resultRows`); selve varen beholder
  decimalerne, så portionen skaleres fra dem. Kcal i listen, "Standard: …", fliserne og
  grænsen i fejlbeskeden skrives med `formatInteger` (`'1.600 kcal'`, `'Højst 9.999 kcal …'`).
- **Søgningen** er en `toObservable(request) → switchMap(search)`-kæde med søgeteksten og
  kataloget (`FoodLogService.foods`) som kilde, så en ny tekst afbryder den forrige, og en ny
  egen vare vises, så snart den er gemt. Søgningen svarer straks, så der er ingen spinner.
- **Grænser** (API'ets `numeric(7,2)`, ellers 500): kalorier 1–9999 og hver makro 0–999 g pr.
  portion, mængde ≥ 1, navn højst 150 tegn; for gram også højst 900 kcal pr. 100 g og ikke
  flere gram makroer end portionen vejer. Hver fejl står under det felt, den handler om
  (`errors`, `FIELD_ERROR_KEY`): Navn (`nameRequired` · `nameTooLong` · `duplicateName`),
  Portion (`amountMin`, og `portionTooSmall` for gram-reglen – `amountRequired`, når mængden er
  tom og derfor tæller som 1 g), Kalorier (`kcalRequired` · `kcalError` · `kcalTooLarge`) og hver
  makro (`macroNegative` · `macroTooLarge`). De påkrævede felter (navn, kalorier) siger først
  noget efter et forsøg på at gemme; de andre fejl vises, så snart værdien er forkert.
  Portionstrinnet blokerer en logning over
  `FOOD_LOG_MAX_KCAL` / `FOOD_LOG_MAX_MACRO_GRAMS` (`amountTooLarge`) – det gælder også
  samlingernes varer. Enhederne er stadig g / stk / port.
- **Enheden vises på brugerens sprog og i flertal** fra 2 (`formatQuantity` /
  `formatQuantityUnit` i `core/utils/quantity.ts`): "Standard: 1 portion", hurtigvalgene
  "1 portion · 2 portioner · …", enheden ved tallet og "Tilføj 2 portioner" (engelsk "servings",
  "pcs"). `picked` og `quantity` beholder tokenet (`'2 portion'`), som API-mapningen læser.
- **Mængden** er en `linkedSignal` med varen som kilde: hver ny vare nulstiller til dens
  standardportion. `null` betyder, at feltet er tømt under indtastning; knappen er slået
  fra, indtil der står et tal over 0 (designet ville ellers logge "0 g").
- **Træk-til-justér** sidder på boksen omkring tallet, ikke på selve feltet (som i designet),
  så almindelig indtastning stadig virker. `touch-action: none` + pointer capture holder
  gestussen, selv om fingeren forlader boksen.
- **Egen vare** følger designets `ownFood`: navn og kalorier kræves; tom mængde bliver `1`,
  tomme makroer `0`. Makroerne pr. portion omregnes til API'ets pr. 100 i `FoodLogService`
  (`toPer100`; stk/portion via en syntetisk serving på 100 g). `Validators.required` godtager mellemrum, så navnet har en egen
  `notBlank`-validator.
- **Genbrug:** `UiTextInput`, `UiIconButton`, `UiIcon`, `UiChip`, `UiButton` (`loading`),
  `UiFormError` og `UiEmptyState`. Enheds- og portionschips er `UiChip` (pille) – designet tegner enhederne
  med 14 px radius, men samme farvelogik. Tallet i portionstrinnet er et nøgent
  display-skrift-felt som i designet og derfor ikke `UiTextInput`.
- Talfeltet er `--size-portion-field` (designets 96 px) bredt, og plus-cirklen i
  resultatrækkerne `--size-control-3xs` (28 px). Den stiplede ikonboks i "Opret …"-rækken er
  `--size-control-2xs` (36 px) mod designets 34 px.

Protein, kulhydrat og fedt må være tomme (0), men kan ikke være negative eller
ikke-endelige tal. Ugyldige værdier vises med en formularfejl og blokerer begge
gemmeknapper samt direkte formularindsendelse.
