# SignupPage

`app-signup-page` – oprettelsesflowets side: `<app-signup-progress>` øverst, det aktive trin
i midten og tilbage-cirkel + primær knap nederst.

| Fil                   | Indhold                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `signup-page.ts`      | Komponenten. Ejer spinner (`submitting`) og fejltekst (`error`).                   |
| `signup-page.html`    | Fremdrift, `@switch` over de 14 trin, fejllinje og fodnoten med knapperne.         |
| `signup-page.scss`    | `page-screen`-layout: fremdrift og knapper er `flex: none`, trinnet fylder resten. |
| `signup-page.spec.ts` | Røgtest: fremdrift, det rigtige trin, knaptekst og deaktiveret knap.               |

## Ansvar

Siden holder ingen data om kladden – den kommer fra `SignupStateService`, som trinnene også
injicerer. Siden ejer kun det, der hører knappen til:

- **Videre-knappen** kalder `next()` på alle trin undtagen `summary`. Dér kalder den
  `submit()`, viser spinner imens, og går til Hjem, når kontoen er oprettet.
- **Fejl** fra oprettelsen vises i en `UiFormError` over knapperne. Backendens danske besked
  bruges, hvis der er en; ellers en generel tekst.
- **Tilbage-cirklen** kalder `back()`. Fra første trin fører den ud af flowet til login –
  det står i servicen, fordi den kender trin-rækkefølgen.

## Layout

Trinnet tegnes i `.signup-page__step`, som er `flex: 1; min-height: 0`. Trinkomponentens egen
`:host` skal være `display: flex; flex-direction: column; flex: 1; min-height: 0`, ellers
kan trinnets scroll-område ikke krympe, og knapperne bliver skubbet ud af skærmen.
