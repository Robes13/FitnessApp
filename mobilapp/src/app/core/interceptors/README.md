# Interceptors

Funktionelle `HttpInterceptorFn`'er, koblet på i `app.config.ts` med
`provideHttpClient(withFetch(), withInterceptors([authInterceptor]))`.

## `authInterceptor` (`auth.interceptor.ts`)

Gælder **kun** kald, hvis URL starter med `API_BASE_URL` – aldrig Open Food Facts eller andre
værter – og aldrig de anonyme auth-endpoints (`ANONYMOUS_AUTH_ENDPOINTS`: register, login,
refresh, email/resend-verification, password/forgot). Bekræftelses- og nulstillingslinks i mails
åbner sider på API'et i browseren; appen kalder dem ikke.

1. **Bearer.** Har sessionen tokens, sættes `Authorization: Bearer <accessToken>`. Uden session
   sendes kaldet uændret.
2. **Proaktiv fornyelse.** `SessionService.accessToken()` fornyer tokenet først, hvis det udløber
   inden for 60 s (`TOKEN_REFRESH_MARGIN_MS`).
3. **Reaktiv fornyelse.** En 401 med **tom body** er JWT-middlewaren, der afviser tokenet: kaldet
   sendes igen **én** gang med et nyt token. Er tokenet allerede fornyet, siden kaldet blev sendt
   (en 401, der lander efter en anden requests fornyelse), bruges det nye token direkte; ellers
   fornyes én gang (single-flight – samtidige 401'ere deler ét `POST auth/refresh`). Refresh-tokenet
   roterer højst én gang pr. UTC-dag (API'et beholder et token, der er udstedt samme dag), men
   dagens første fornyelse roterer det – derfor stadig single-flight. En 401 **med** en ProblemDetails-body er
   en forretningsfejl (fx "Current password is invalid.") og sendes videre uden fornyelse.
   **`auth/logout` gentages aldrig her** (`NO_RETRY_ENDPOINTS`): dens body har refresh-tokenet fra
   før fornyelsen, så en gentagelse ville revokere det brugte token og lade det nye være aktivt.
   `SessionService.logout()` fornyer og sender selv igen med det aktuelle token.
4. **Afvist fornyelse.** Svarer `auth/refresh` med 4xx, afslutter `SessionService` sessionen
   (gæst) og sender brugeren til login. Ved netværks- eller serverfejl beholdes sessionen, og
   fejlen går videre til kalderen.
5. **Sene svar efter log ud.** Et svar, der lander, efter at kontoen, der sendte kaldet, er logget
   ud (eller en anden konto er logget ind), smides væk (`SessionService.accountId`): kaldet
   completer uden værdi, så fx et "Prøv igen"-load ikke fylder en store igen efter `reset()`.
   Fejl går altid videre.

**Ved app-start** kalder `SessionService.renewOnOpen()` `refresh()` én gang (spec 1.5), før storene
indlæses; deres første `/me/**`-kald deler den samme single-flight-fornyelse, hvis tokenet er ved at
udløbe.

Der er ingen DI-cyklus: interceptoren injicerer `SessionService` først, når et kald køres, og
`auth/refresh` er selv et anonymt endpoint, så fornyelsen går uden om interceptoren.

## Native og CORS

API'et har ingen CORS-politik. I browseren går kaldene gennem dev-proxyen (`/api/v1` →
`proxy.conf.json`); i de native apps sender `CapacitorHttp` (`capacitor.config.ts`) de absolutte
URL'er gennem platformens HTTP-stak, så WebView'ets CORS-regler ikke gælder.

## Test

`auth.interceptor.spec.ts` giver interceptoren eksplicit:

```ts
providers: [
  ...provideCoreTestEnvironment({ storage }),
  provideRouter([]),
  provideHttpClient(withInterceptors([authInterceptor])),
  provideHttpClientTesting(),
],
```

De globale spec-providers har kun `HttpClient` på testing-backenden uden interceptoren.
