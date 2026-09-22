# FoodPage

Skærmen bag `/mad` (`app-food-page`). Den viser dagens kalorier og makroer, de fire
måltidsgrupper og knapperne "Tilføj mad" og scan — og den ejer tilstanden omkring
`app-food-add-sheet` og `app-barcode-scanner`.

| Fil                 | Indhold                                                                      |
| ------------------- | ---------------------------------------------------------------------------- |
| `food-page.ts`      | Sidens UI-tilstand: åbent ark, valgt måltid, vare under redigering, scanner. |
| `food-page.html`    | Scroll-området, arket og scanneren.                                          |
| `food-page.scss`    | `page-screen` + `scroll-area`, kalorie- og makrokort.                        |
| `food-page.spec.ts` | Smoke test: indhold, fjern vare, `?tilfoej=`, tilføj-links og scanner.       |

## Beslutninger

- Alle tal kommer fra `FoodViewService`; siden regner ikke selv.
- Loggen ændres kun her — arket og scanneren rapporterer færdige varer via outputs.
- Host-elementet må **ikke** være `position: relative`: arket og scanneren lægger sig med
  `position: absolute` over hele app-roden (shell'en), ikke kun over siden.
