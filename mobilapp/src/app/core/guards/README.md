# Guards

Route guards til adgangskontrol – og kun det. De henter ikke data og indeholder ingen
forretningslogik.

| Guard        | Regel                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| `authGuard`  | Kræver login. Ikke logget ind → `APP_PATH.LOGIN`.                        |
| `guestGuard` | Kun for gæster (login, glemt kode, opret). Logget ind → `APP_PATH.HOME`. |

Begge læser `SessionService.isLoggedIn()` synkront og returnerer enten `true` eller et
`UrlTree`, så routeren selv omdirigerer.
