# FoodPage

Skærmen bag `/mad` (`app-food-page`). Den viser dagens kalorier og makroer, de fire
måltidsgrupper og knapperne "Tilføj mad" og scan — og den ejer tilstanden omkring
`app-food-add-sheet` og `app-barcode-scanner`.

| Fil                 | Indhold                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `food-page.ts`      | Sidens UI-tilstand: åbent ark, valgt måltid, vare under redigering, scanner, fjern-bekræftelse, `pending` og fejl.                                          |
| `food-page.html`    | Scroll-området, arket og scanneren.                                                                                                                         |
| `food-page.scss`    | `page-screen` + `scroll-area`, kalorie- og makrokort.                                                                                                       |
| `food-page.spec.ts` | Indhold, indlæsning/fejl (også profilens), fjern med bekræftelse og 404, logning med `pending` og fejl, redigér mængde, `?tilfoej=`, tilføj-links, scanner. |

## Beslutninger

- Alle tal kommer fra `FoodViewService`; siden regner ikke selv.
- Loggen ændres kun her — arket og scanneren rapporterer færdige varer via outputs, og
  siden abonnerer på `FoodLogService`'s `Observable`s (`add`, `update`, `addCustomFood`,
  `remove`) ét ad gangen (`run`, guard på `pending`). Kaldene afbrydes ikke, når siden lukkes,
  så en gemning aldrig går tabt.
- Redigering ændrer kun mængden (`update(logId, item)` → `PATCH { quantity, unit }`); der er
  ingen makroredigering og intet `PATCH foods` (P12).
- "Gem og log …" og en scannet vare logges med `add()`, der selv opretter varen (`ensureFood`).
  "Gem uden at logge" gemmer med `addCustomFood()`.
- **Fejl** vises med `app-ui-form-error` – i arket, mens det er åbent, og under knapperne.
  API'ets generelle "noget gik galt" bliver _Varen blev ikke gemt/fjernet. Prøv igen._;
  netværk, server og "findes ikke længere" beholder deres egen tekst, og 409 giver
  `food.page.duplicateCustomFood` med navnet. Beskeden forsvinder, når arket eller scanneren
  åbnes igen.
- **Status** er madloggens og profilens `status` samlet (kaloriemålet kommer fra profilen):
  spinner under første indlæsning, fejltilstand med "Prøv igen", der kun genindlæser den
  store, der fejlede (uden `takeUntilDestroyed`, så en store aldrig hænger i `loading`).
- Host-elementet må **ikke** være `position: relative`: arket og scanneren lægger sig med
  `position: absolute` over hele app-roden (shell'en), ikke kun over siden.
