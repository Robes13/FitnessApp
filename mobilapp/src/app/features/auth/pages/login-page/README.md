# LoginPage

`app-login-page` – designets loginskærm (`Fitness App.dc.html` linje 88–110).

| Fil                  | Indhold                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `login-page.ts`      | `FormGroup<LoginForm>`, `loading`/`errorMessage` som signals, `submit()`.         |
| `login-page.html`    | Foto, logo + wordmark, overskrift, felter og fodnoter.                            |
| `login-page.scss`    | Fotoet i bunden af stakken, indholdet i en flex-kolonne med spacer over teksten.  |
| `login-page.spec.ts` | Struktur og tekster, vellykket login → Hjem, og backendens fejl ved tomme felter. |

## Opbygning

Værten er `position: relative; height: 100%`. Fotoet (`app-auth-backdrop`) ligger absolut bag
indholdet, og `.login-page__content` er en flex-kolonne med logoet øverst, en `flex: 1`-spacer
og resten i bunden – præcis som designets `padding: 80px 24px 44px`.

## Login

`submit()` kalder `SessionService.login()`. Knappen viser `UiButton`s spinner via `loading`, og
en fejl fra mock-backenden (fx `Udfyld brugernavn og adgangskode.`) vises i
`app-ui-form-error`. Fejllinjen står i et `@if`, så den **kun** findes i DOM'en, når der er en
fejl – ellers ville dens reserverede højde lægge tom luft mellem adgangskodefeltet og
`Log ind`, som designet ikke har. Ved succes navigeres til `APP_PATH.HOME`. Abonnementet lukkes
med `takeUntilDestroyed`.

Designets øje-knap på adgangskodefeltet er `UiTextInput`s indbyggede `revealable`, som er slået
til som standard for `type="password"`.
