# Guards

Route guards til adgangskontrol – og kun det. De henter ikke data og indeholder ingen
forretningslogik.

| Guard        | Regel                                                                    |
| ------------ | ------------------------------------------------------------------------ |
| `authGuard`  | Kræver login. Ikke logget ind → `APP_PATH.LOGIN`.                        |
| `guestGuard` | Kun for gæster (login, glemt kode, opret). Logget ind → `APP_PATH.HOME`. |

Begge ligger i `auth.guard.ts` og læser `SessionService.isLoggedIn()` synkront. De
returnerer enten `true` eller et `UrlTree`, så routeren selv omdirigerer.
