# Mad

Fanen **Mad** (`/mad`): dagens kalorier og makroer, de fire måltidsgrupper og de to veje ind i
loggen — "Tilføj mad"-arket og stregkodescanneren.

| Fil / mappe                           | Indhold                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `food.routes.ts`                      | `FOOD_ROUTES`: én rute (`''` → `FoodPage`), som provider `FoodViewService`.  |
| [`pages/`](pages/README.md)           | `FoodPage` — selve skærmen.                                                  |
| [`components/`](components/README.md) | `FoodMealGroup` (én måltidsgruppe) og `FoodAddSheet` ("Tilføj mad"-arket).   |
| [`services/`](services/README.md)     | `FoodViewService` — de afledte tal (kaloriering, makrokort, måltidsgrupper). |

Featuren ejer **ingen** data. Loggen bor i `FoodLogService`, kaloriemålet i
`UserProfileService`, samlingerne i `CollectionsService`, og søgning, portionsvalg og scanning
ligger i de delte komponenter `app-food-picker` og `app-barcode-scanner`.

## Flow

```
FoodPage
├── kalorieringen + 3 makrokort        (FoodViewService)
├── "Tilføj mad" ─────────────────────► FoodAddSheet
├── scan-knappen ─────────────────────► app-barcode-scanner
└── 4 × FoodMealGroup
     ├── tryk på en vare ─────────────► FoodAddSheet (redigér portionen)
     ├── ✕ ───────────────────────────► FoodLogService.remove
     └── "+ Tilføj til <måltid>" ─────► FoodAddSheet (på det måltid)
```

`FoodAddSheet` sender én færdig vare tilbage via `selected`. Siden afgør, om den skal
**opdatere** den vare, der redigeres, eller **lægges** i loggen under det valgte måltid — det er
det eneste sted, loggen ændres fra denne feature.

## Beslutninger

- **Arket nulstilles ved hver åbning.** Indholdet i `app-ui-sheet` ligger bag `@if (open())`.
  Projiceret indhold oprettes ellers sammen med forælderen og ville huske sidste søgning og
  sidste portionstrin, næste gang arket blev åbnet.
- **Chips og faner hører til søgetrinnet.** Måltids-chipsene og Varer/Samlinger skjules, så
  snart vælgeren går videre til "Ny egen vare" eller portionstrinnet — og altid, når en logget
  vare redigeres. Så er måltidet givet, og arket hedder "Rediger vare" i stedet for
  "Tilføj morgenmad" (designets `addSheetVerb` / `addSheetWhat`).
- **En samling logges som én vare.** Designets `addCollections` lægger hele samlingen ind som
  én linje: samlingens navn, `n varer` som portion og summen af retter og løse varer
  (`CollectionsService.collectionTotals`). Samlinger uden indhold vises ikke.
- **`?tilfoej=<måltid>`** (fra "Næste skridt" på Hjem) bindes som input via
  `withComponentInputBinding()` og fjernes fra URL'en igen med `replaceUrl`, så et tilbage-tryk
  eller en genindlæsning ikke åbner arket på ny. Angulars compiler kræver en literal i
  `input(…, { alias })`, så parameternavnet står skrevet ud i `food-page.ts` — konstanten
  `ADD_MEAL_PARAM` er typet mod `QUERY_PARAM.ADD_MEAL` og fejler i build, hvis de to skilles ad.
- **Scanneren er en søskende til arket, ikke en del af det.** `app-barcode-scanner` udsender
  altid `closed` til sidst, så siden lukker overlayet ét sted og håndterer resultatet
  (`found`, `customSaved`, `manualRequested`, `noBarcodeRequested`) for sig.
- **Ikonflisen på en samling farves efter måltidet** (morgen orange, frokost grøn, aften blå,
  snack rød) som designets `mealTints`. Reglen bor i `core/constants/meals.ts` (`MEAL_TONES`),
  fordi Samlinger-skærmen bruger den samme tabel.
- **Arket bruger `UiSheet`s `column`**, ikke `scrollable`: måltids-chips og fanerne
  Varer/Samlinger bliver stående øverst, mens `.food-add-sheet__scroll` ejer scroll-området —
  som i designet.
