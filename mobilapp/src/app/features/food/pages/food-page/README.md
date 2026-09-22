# FoodPage

Skærmen bag `/mad` (`app-food-page`). Den viser dagens kalorier og makroer, de fire
måltidsgrupper og knapperne "Tilføj mad" og scan — og den ejer tilstanden omkring
`app-food-add-sheet` og `app-barcode-scanner`.

| Fil                 | Indhold                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `food-page.ts`      | Sidens UI-tilstand: åbent ark, valgt måltid, vare under redigering, scanner. |
| `food-page.html`    | Scroll-området, arket og scanneren.                                          |
| `food-page.scss`    | `page-screen` + `scroll-area`, kalorie- og makrokort.                        |
| `food-page.spec.ts` | Smoke test: indhold, fjern/redigér vare, `?tilfoej=`, tilføj-links, scanner. |

## Beslutninger

- Alle tal kommer fra `FoodViewService`; siden regner ikke selv.
- Loggen ændres kun her — arket og scanneren rapporterer færdige varer via outputs.
- Redigeres en logget egen vare, kommer `customFoodEdited` før `selected`: siden gemmer
  varen med `FoodLogService.updateCustomFood` og opdaterer derefter posten med de
  genberegnede tal.
- Nye egne varer gemmes med vælgerens id (`addCustomFood(input, item.id)`), så en vare fra
  "Gem og log …" logges med samme id som den egne vare og kan redigeres bagefter.
- Kaster `addCustomFood` `DuplicateCustomFoodNameError` (scannerens "Ukendt vare" tjekker selv
  navnet, så det sker kun i sjældne kapløb), logges varen alligevel, og siden viser en besked med `app-ui-form-error` under
  knapperne. Beskeden forsvinder, når arket eller scanneren åbnes igen.
- Host-elementet må **ikke** være `position: relative`: arket og scanneren lægger sig med
  `position: absolute` over hele app-roden (shell'en), ikke kun over siden.
