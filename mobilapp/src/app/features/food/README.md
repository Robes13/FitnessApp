# Mad

Fanen **Mad** (`/mad`): dagens kalorier og makroer, de fire måltidsgrupper og de to veje ind i
loggen — "Tilføj mad"-arket og stregkodescanneren.

| Fil / mappe                           | Indhold                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `food.routes.ts`                      | `FOOD_ROUTES`: én rute (`''` → `FoodPage`), som provider `FoodViewService`.  |
| [`pages/`](pages/README.md)           | `FoodPage` — selve skærmen.                                                  |
| [`components/`](components/README.md) | `FoodMealGroup` (én måltidsgruppe) og `FoodAddSheet` ("Tilføj mad"-arket).   |
| [`services/`](services/README.md)     | `FoodViewService` — de afledte tal (kaloriering, makrokort, måltidsgrupper). |

Featuren ejer **ingen** data. Loggen og brugerens katalog bor i `FoodLogService` (API'et),
kaloriemålet i `UserProfileService`, samlingerne i `CollectionsService`, og søgning,
portionsvalg og scanning ligger i de delte komponenter `app-food-picker` og
`app-barcode-scanner`.

## Flow

```
FoodPage
├── kalorieringen + 3 makrokort        (FoodViewService)
├── "Tilføj mad" ─────────────────────► FoodAddSheet
├── scan-knappen ─────────────────────► app-barcode-scanner
└── 4 × FoodMealGroup
     ├── tryk på en vare ─────────────► FoodAddSheet (redigér kun mængden)
     ├── ✕ ─► UiConfirmSheet ─► "Ja" ─► FoodLogService.remove
     └── "+ Tilføj til <måltid>" ─────► FoodAddSheet (på det måltid)
```

`FoodAddSheet` sender én færdig vare tilbage via `selected`. Siden afgør, om den skal
**opdatere** den vare, der redigeres (`update` – kun mængden, spec 3.3), eller **lægges** i
loggen under det valgte måltid (`add`, `mealType`) — det er det eneste sted, loggen ændres fra
denne feature. Alle kald er pessimistiske: arket lukker først, når API'et har svaret, `pending`
viser spinner på knappen og blokerer et nyt kald, og en fejl vises i arket (og under knapperne).

## Tilstande

- **Første indlæsning:** `UiSpinner`, mens madloggen (eller profilen med kaloriemålet)
  indlæses.
- **Fejl:** fejler madloggen eller profilen, vises _Vi kunne ikke hente din mad og dit
  kaloriemål._ og "Prøv igen", der genindlæser den eller de stores, der fejlede.
- **Tom:** de fire måltidsgrupper viser kun deres tilføj-link.

## Beslutninger

- **Arket nulstilles ved hver åbning.** Indholdet i `app-ui-sheet` ligger bag `@if (open())`.
  Projiceret indhold oprettes ellers sammen med forælderen og ville huske sidste søgning og
  sidste portionstrin, næste gang arket blev åbnet.
- **Chips og faner hører til søgetrinnet.** Måltids-chipsene og Varer/Samlinger skjules, så
  snart vælgeren går videre til "Ny egen vare" eller portionstrinnet — og altid, når en logget
  vare redigeres. Så er måltidet givet, og arket hedder "Rediger vare" i stedet for
  "Tilføj morgenmad" (designets `addSheetVerb` / `addSheetWhat`).
- **En samling logges i ét kald** (P13): fanen "Samlinger" kalder `CollectionsService.log()`
  (`POST me/meal-collections/{id}/log`), og API'et opretter én række pr. vare under det
  valgte måltid, så hver række kan rettes og fjernes for sig. Arket lukker, når API'et har svaret;
  en fejl vises i arket, der bliver åbent.
- **`?tilfoej=<måltid>`** (fra "Næste skridt" på Hjem) bindes som input via
  `withComponentInputBinding()` og fjernes fra URL'en igen med `replaceUrl`, så et tilbage-tryk
  eller en genindlæsning ikke åbner arket på ny. Angulars compiler kræver en literal i
  `input(…, { alias })`, så parameternavnet står skrevet ud i `food-page.ts` — konstanten
  `ADD_MEAL_PARAM` er typet mod `QUERY_PARAM.ADD_MEAL` og fejler i build, hvis de to skilles ad.
- **Scanneren er en søskende til arket, ikke en del af det.** `app-barcode-scanner` udsender
  altid `closed` til sidst, så siden lukker overlayet ét sted og håndterer resultatet
  (`found`, `manualRequested`, `noBarcodeRequested`) for sig. En scannet vare bliver brugerens
  egen vare, når den logges (`FoodLogService.add` → `ensureFood`). "Ikke fundet" →
  "Varen har ingen stregkode" åbner vælgerens fulde "Ny egen vare" (3.1-6a → 3.0).
- **Fjern kræver bekræftelse** (3.4) i det fælles `shared/components/ui-confirm-sheet`, der ikke
  kan lukkes med et tryk på baggrunden. Er varen allerede væk (404), fjernes den alligevel, og
  siden skriver _Varen findes ikke længere._
- **Ikonflisen på en samling** er `utensils` i accent-farven – API'et har hverken ikon eller
  måltid på en samling (P13), så designets `mealTints` bruges ikke længere.
- **Arket bruger `UiSheet`s `column`**, ikke `scrollable`: måltids-chips og fanerne
  Varer/Samlinger bliver stående øverst, mens `.food-add-sheet__scroll` ejer scroll-området —
  som i designet.
