# Shared

Genbrugelige, feature-agnostiske byggeklodser. `shared` må importere fra `core`, men aldrig fra
`features` – og en feature må aldrig importere fra en anden feature. Skal to features dele
UI, flyttes det hertil; skal de dele logik eller typer, flyttes det til `core`.

## Mapper

| Mappe                                 | Indhold                                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [`components/`](components/README.md) | UI-komponenter uden forretningslogik: data ind via `input()`/`model()`, hændelser ud via `output()`. |

## Principper

- **Ingen forretningslogik.** En shared-komponent kender ikke til måltider, vægt eller
  brugere – kun til det, den skal tegne. Core-services injiceres kun, hvor spec'en siger det
  (fx `FoodPicker`, `BarcodeScanner`).
- **Én komponent pr. mappe**, filnavne i kebab-case uden `.component`-suffiks
  (`ui-button.ts`, `ui-button.html`, `ui-button.scss`, `ui-button.spec.ts`). Klassen hedder
  `UiButton`, selectoren `app-ui-button` – eller en attribut-selector
  (`button[app-ui-button]`), når komponenten skal sidde på et native element for at beholde
  dets semantik (`disabled`, `type`, `routerLink`).
- **Ingen barrel-filer.** Hver komponent importeres fra sin egen fil. Undtagelsen er
  `components/figure/index.ts`, fordi figuren består af flere sammenhørende dele.
- **Tokens og BEM.** Al styling bruger `var(--token)` fra `src/styles/_tokens.scss`, og
  blocknavnet matcher komponenten (`.ui-chip`, `.ui-chip__label`, `.ui-chip--selected`).
  Dynamisk geometri (antal segmenter, valgt indeks) bindes som CSS-variabler fra TypeScript.
- **Tilgængelighed er en del af API'et.** Ikon-knapper kræver `aria-label`, felter har
  `ariaLabel`, kontakter og segmenter har radiogroup-/switch-semantik.
- **Host-styling skrives som `:host`.** Sætter komponenten sin block-klasse på værten
  (`host: { class: 'ui-chip' }` eller `[class]`), skal reglen for værten være `:host { … }` og
  modifiers `:host(.ui-chip--selected) { … }`. Under Angulars emulerede encapsulation bliver
  `.ui-chip { … }` omskrevet til `.ui-chip[_ngcontent-…]`, som kun matcher komponentens
  _indhold_ – værten bærer `_nghost-…` og rammes aldrig. Element-regler (`.ui-chip__label`)
  skrives som normalt.
