# ForgotPasswordPage

`app-forgot-password-page` – "Glemt adgangskode" (spec 1.4) på designets fotoskærm
(`Fitness App.dc.html` linje 113–182, trin 1).

| Fil                            | Indhold                                                                 |
| ------------------------------ | ----------------------------------------------------------------------- |
| `forgot-password-page.ts`      | Én typed formular (identifikator), `loading`/`sent`/`resent`, `send()`. |
| `forgot-password-page.html`    | Foto, tilbage-knap + logo og enten feltet eller den neutrale besked.    |
| `forgot-password-page.scss`    | Layoutet (overskrift, brødtekst, felt, knap, fodnote).                  |
| `forgot-password-page.spec.ts` | Præcis ét kald pr. tryk, "Send igen", netværksfejl, tomt felt, tilbage. |

## Forløb

1. **Glemt din adgangskode?** – ét felt, `E-mail eller brugernavn` (`autocomplete="username"`),
   udfyldt med `SessionService.email()`. "Send link" sender `POST auth/password/forgot`
   `{ emailOrUsername }` (trimmet) – men kun, når feltet ikke er tomt.
2. **Tjek din mail** – API'et svarer altid 204, så siden viser den neutrale besked: "Hvis kontoen
   findes, har vi sendt en mail med et link til at vælge en ny adgangskode. Linket virker i 1
   time." Knappen hedder nu "Send igen" (samme kald; API'et gør det forrige link ugyldigt) og
   derefter "Sendt igen".

Mailen linker til en side, som **API'et** hoster (ny adgangskode to gange, ingen JavaScript). Appen
ser aldrig tokenet, så der er hverken kodefelt, adgangskodefelter eller login bagefter – brugeren
går tilbage til appen og logger ind. Tilbage-knappen og "Log ind" i fodnoten går til `/login`.

## Detaljer

- **Præcis ét kald pr. tryk.** `send()` gør intet, mens et kald kører (og `UiButton` blokerer
  klik under `loading`), fordi hvert kald revokerer det link, brugeren lige har fået.
- **Fejl** (fx ingen forbindelse) vises i `app-ui-form-error`, og siden bliver på formularen.
  Fejllinjen findes kun, når der er en fejl.
