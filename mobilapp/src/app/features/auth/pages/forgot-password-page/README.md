# ForgotPasswordPage

`app-forgot-password-page` – designets "Glemt adgangskode" (`Fitness App.dc.html` linje
113–182) med alle fire trin i én route-komponent.

| Fil                            | Indhold                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `forgot-password-page.ts`      | `step`-signal, tre typede formulargrupper, hints, styrkemåler og backend-kald.  |
| `forgot-password-page.html`    | Foto med forløb, tilbage-knap + logo og `@switch` over de fire trin.            |
| `forgot-password-page.scss`    | Fælles trin-layout (eyebrow, overskrift, brødtekst, felt, hint, knap, fodnote). |
| `forgot-password-page.spec.ts` | Hele forløbet, hints, cifferfiltrering, styrkemåler, tilbage og oprydning.      |

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
- **Kodefeltet** holder kun cifre og højst fire (designets `setFpCode`). Filtreringen sker på
  `valueChanges`, som sætter den rensede værdi tilbage – det udsender med vilje igen, så
  signalet følger med.
- **Styrkemåleren** er `NutritionCalculator.passwordStrength()` tegnet med `UiProgressBar`.
  Tonen (`negative` · `accent` · `warning` · `positive`) farver både bjælken og etiketten
  (`Svag` · `OK` · `God` · `Stærk`) og svarer til designets `fpStrength`.
- **Kvitteringstrinnet** viser `UiSpinner` og "Logger ind med ny kode…", venter
  `FORGOT_PASSWORD_DONE_DELAY_MS` (1400 ms) og logger derefter ind med
  `SessionService.login()`. `takeUntilDestroyed` rydder timeren, hvis siden forlades inden, og
  et fejlet login sender brugeren tilbage til trin 3 med fejlteksten.
  Loginet bruger profilens **rå** brugernavn (`profile().username`), ikke `displayName()` –
  `SessionService.login()` gemmer det, den får, så demo-navnet "Mads" ville ellers blive skrevet
  ind i en tom profil som brugerens rigtige brugernavn. Er brugernavnet tomt, er der intet at
  logge ind med (`AuthApi.login('')` fejler), så siden sender i stedet brugeren til `/login`
  efter ventetiden.

## Kendte afvigelser

Gentag-feltets kant bliver **rød** ved uens adgangskoder, hvor designet bruger orange –
`UiTextInput.invalid` har kun den negative tone.
