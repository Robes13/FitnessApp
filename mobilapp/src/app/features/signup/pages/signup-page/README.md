# SignupPage

`app-signup-page` – oprettelsesflowets side: `<app-signup-progress>` øverst, det aktive trin
i midten og tilbage-cirkel + primær knap nederst.

| Fil                   | Indhold                                                                            |
| --------------------- | ---------------------------------------------------------------------------------- |
| `signup-page.ts`      | Komponenten. Ejer spinner (`submitting`) og fejltekst (`error`).                   |
| `signup-page.html`    | Fremdrift, `@switch` over de 14 trin, fejllinje og fodnoten med knapperne.         |
| `signup-page.scss`    | `page-screen`-layout: fremdrift og knapper er `flex: none`, trinnet fylder resten. |
| `signup-page.spec.ts` | Fremdrift, trin, knaptekst, fejllinjen og en tom kladde ved hvert nyt besøg.       |

## Ansvar

Siden holder ingen data om kladden – den kommer fra `SignupStateService`, som trinnene også
injicerer. Siden **leverer** servicen (`providers`), så kladden og adgangskoden nedlægges sammen
med siden, og hvert besøg på `/opret` starter tomt. Siden ejer kun det, der hører knappen til:

- **Videre-knappen** kalder `next()` på alle trin undtagen `summary`. Dér kalder den
  `submit()`, viser spinner imens, og går til Hjem, når kontoen er oprettet.
- **Fejl** fra oprettelsen vises i en `UiFormError` over knapperne som
  `toApiError(error).messageKey` – fx e-mail/brugernavn optaget eller en generel tekst. Nøglen
  gemmes, så teksten følger et sprogskift, og den nulstilles (`linkedSignal` på trin og e-mail),
  så snart brugeren retter: et trin åbnes fra opsummeringen, eller e-mailen ændres.
- Uden en fejl fra API'et siger samme linje på opsummeringen "Skriv en gyldig e-mail."
  (`core.auth.error.invalidEmail`), når `SignupStateService.emailInvalid` er sand.
- **Tilbage-cirklen** kalder `back()`. Fra første trin fører den ud af flowet til login –
  det står i servicen, fordi den kender trin-rækkefølgen.
- **Androids tilbageknap** kommer som Escape (`BackButtonService`) og går ét trin tilbage som
  cirklen, så kladden bevares (1.0-14a). På første trin (`backLeavesFlow`) lader siden den være,
  så appen går tilbage i historikken til login. Flowet har ingen ark, så siden er den eneste,
  der lytter på Escape her.

## Layout

Trinnet tegnes i `.signup-page__step`, som er `flex: 1; min-height: 0`. Trinkomponentens egen
`:host` skal være `display: flex; flex-direction: column; flex: 1; min-height: 0`, ellers
kan trinnets scroll-område ikke krympe, og knapperne bliver skubbet ud af skærmen.
