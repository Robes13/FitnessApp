# LoginPage

`app-login-page` – designets loginskærm (`Fitness App.dc.html` linje 88–110).

| Fil                  | Indhold                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `login-page.ts`      | `FormGroup<LoginForm>` (identifikator + adgangskode), `loading`/`errorKey`, `submit()`.                                            |
| `login-page.html`    | Foto, logo + wordmark, overskrift, felter og fodnoter.                                                                             |
| `login-page.scss`    | Fotoet i bunden af stakken, indholdet i en flex-kolonne med spacer over teksten.                                                   |
| `login-page.spec.ts` | Struktur og tekster, login med e-mail og brugernavn → Hjem, 403 → Hjem (venter på bekræftelse), 401/429-tekster og udfyldt e-mail. |

## Opbygning

Værten er `position: relative; height: 100%`. Fotoet (`app-auth-backdrop`) ligger absolut bag
indholdet, og `.login-page__content` er en flex-kolonne med logoet øverst, en `flex: 1`-spacer
og resten i bunden – præcis som designets `padding: 80px 24px 44px`.
Mens skærmtastaturet er åbent, krymper siden over det, og felterne ligger oven på fotoets lyse
midte: da får fotoet forløbet (`[gradient]="keyboardOpen()"`), så fejllinjen er lige så læsbar
som på den mørke bund.

## Login

Det første felt tager **e-mail eller brugernavn** (`E-mail eller brugernavn`, `type="text"`,
`autocomplete="username"`, intet `inputmode`, højst 320 tegn som API'et –
`LOGIN_IDENTIFIER_MAX_LENGTH`); API'et skelner på `@`, og brugernavne matches uden forskel på store og
små bogstaver. Det udfyldes fra
`SessionService.email()`, som husker adressen efter log ud og efter en genstart.

`submit()` kalder `SessionService.login()` – men kun, når begge felter er udfyldt (ellers ville
API'et blot svare med en generisk 400). Knappen viser `UiButton`s spinner via `loading`. Svarer
API'et **403** (rigtig adgangskode, e-mailen er ikke bekræftet), completer loginet uden fejl:
sessionen bliver `pending-verification`, og siden navigerer til `APP_PATH.HOME` som ved succes, hvor
bekræftelses-arket åbner. Andre fejl vises i `app-ui-form-error` – ved 401/400
`Forkert brugernavn, e-mail eller adgangskode.` (API'et siger ikke hvad) og ved 429
`For mange mislykkede forsøg. Vent op til 15 minutter, og prøv igen.`. Fejllinjen står i et
`@if`, så den **kun** findes i DOM'en, når der er en fejl – ellers ville dens reserverede højde
lægge tom luft mellem adgangskodefeltet og `Log ind`, som designet ikke har. Abonnementet lukkes
med `takeUntilDestroyed`.

Designets øje-knap på adgangskodefeltet er `UiTextInput`s indbyggede `revealable`, som er slået
til som standard for `type="password"`.
