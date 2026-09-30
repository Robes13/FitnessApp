# LoginPage

`app-login-page` – designets loginskærm (`Fitness App.dc.html` linje 88–110).

| Fil                  | Indhold                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `login-page.ts`      | `FormGroup<LoginForm>` (e-mail + adgangskode), `loading`/`errorKey`, `submit()`. |
| `login-page.html`    | Foto, logo + wordmark, overskrift, felter og fodnoter.                           |
| `login-page.scss`    | Fotoet i bunden af stakken, indholdet i en flex-kolonne med spacer over teksten. |
| `login-page.spec.ts` | Struktur og tekster, login mod API'et → Hjem, afvist login og udfyldt e-mail.    |

## Opbygning

Værten er `position: relative; height: 100%`. Fotoet (`app-auth-backdrop`) ligger absolut bag
indholdet, og `.login-page__content` er en flex-kolonne med logoet øverst, en `flex: 1`-spacer
og resten i bunden – præcis som designets `padding: 80px 24px 44px`.

## Login

API'et logger ind med e-mail, så det første felt er `E-mail` (`type="email"`,
`inputmode="email"`, `autocomplete="email"`). Det udfyldes fra `SessionService.email()`, som
husker adressen efter log ud og efter en e-mailbekræftelse uden gemt adgangskode.

`submit()` kalder `SessionService.login()` – men kun, når begge felter er udfyldt (ellers ville
API'et blot svare med en generisk 400). Knappen viser `UiButton`s spinner via `loading`, og
en fejl vises i `app-ui-form-error` – fx ved 401 `Forkert e-mail eller adgangskode – eller også
er din mail ikke bekræftet endnu.` (API'et svarer det samme i begge tilfælde). Fejllinjen står i et `@if`, så den **kun** findes i DOM'en, når der er en
fejl – ellers ville dens reserverede højde lægge tom luft mellem adgangskodefeltet og
`Log ind`, som designet ikke har. Ved succes navigeres til `APP_PATH.HOME`. Abonnementet lukkes
med `takeUntilDestroyed`.

Designets øje-knap på adgangskodefeltet er `UiTextInput`s indbyggede `revealable`, som er slået
til som standard for `type="password"`.
