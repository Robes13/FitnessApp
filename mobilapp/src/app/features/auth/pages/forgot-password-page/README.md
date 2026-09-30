# ForgotPasswordPage

`app-forgot-password-page` – designets "Glemt adgangskode" (`Fitness App.dc.html` linje
113–182) med alle fire trin i én route-komponent.

| Fil                            | Indhold                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `forgot-password-page.ts`      | `step`-signal, tre typede formulargrupper, hints, styrkemåler og API-kald.      |
| `forgot-password-page.html`    | Foto med forløb, tilbage-knap + logo og `@switch` over de fire trin.            |
| `forgot-password-page.scss`    | Fælles trin-layout (eyebrow, overskrift, brødtekst, felt, hint, knap, fodnote). |
| `forgot-password-page.spec.ts` | Hele forløbet mod API'et, hints, afvist token og tilbage-knappen.               |

## Trin

| `step`         | Designets skærm | Overskrift                 | Knap              |
| -------------- | --------------- | -------------------------- | ----------------- |
| `email`        | `fp1`           | Glemt din **adgangskode?** | `Send kode`       |
| `code`         | `fp2`           | Tjek din **mail**          | `Bekræft kode`    |
| `new-password` | `fp3`           | Vælg en ny **adgangskode** | `Gem adgangskode` |
| `done`         | `fpDone`        | –                          | –                 |

Tilbage-knappen går ét trin tilbage; fra `email` (og fra `done`) videre til `/login`.

## Detaljer

- **E-mail-hintet** vises først, når der er skrevet mere end tre tegn (designets
  `fpEmailHint`), og knappen er slået fra, indtil `NutritionCalculator.isValidEmail()` siger
  god for adressen. Feltet starter med profilens e-mail, ligesom designets `toForgot`.
- **Kodefeltet** tager det token på 64 tegn, brugeren kopierer fra mailen (gyldigt i 1 time).
  Der er ikke noget cifferfilter eller nogen længdegrænse: det indsatte normaliseres
  (`normalizeAuthToken()` fjerner mellemrum og laver store bogstaver), og "Bekræft kode" er
  slået fra, indtil det passer til `AUTH_TOKEN_PATTERN`. API'et har ikke noget endpoint, der
  tjekker koden alene, så trin 2 tjekker kun formatet lokalt.
- **Ny adgangskode** sendes sammen med tokenet i `POST auth/password/reset`
  (`{ token, newPassword, newPasswordConfirmation }`). Afviser API'et tokenet (brugt eller
  udløbet), går siden tilbage til trin 2 med fejlteksten.
- **Styrkemåleren** er `NutritionCalculator.passwordStrength()` tegnet med `UiProgressBar`.
  Tonen (`negative` · `accent` · `warning` · `positive`) farver både bjælken og etiketten
  (`Svag` · `OK` · `God` · `Stærk`) og svarer til designets `fpStrength`.
- **Kvitteringstrinnet** viser `UiSpinner` og "Logger ind med ny kode…", venter
  `FORGOT_PASSWORD_DONE_DELAY_MS` (1400 ms) og logger derefter ind med e-mailen fra trin 1 og
  den nye adgangskode (`SessionService.login()`). `takeUntilDestroyed` rydder timeren, hvis
  siden forlades inden. Tokenet er brugt, når loginet kører, så et fejlet login kan ikke gå
  tilbage til trin 3: kvitteringen skifter til "Din adgangskode er skiftet, men vi kunne ikke
  logge dig ind.", fejlen (fx ingen forbindelse) og et "Log ind"-link.

## Kendte afvigelser

Gentag-feltets kant bliver **rød** ved uens adgangskoder, hvor designet bruger orange –
`UiTextInput.invalid` har kun den negative tone.
