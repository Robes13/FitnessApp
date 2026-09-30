# Åbne review-fund fra bølge 0

> **Status:** alle 24 fund er rettet i `f1e2d55` (se `plan-v2.md` §6). Med de nye flows bliver koden
> bag fire af dem forældet og slettes af `auth` i bølge 2: login efter reset på glemt-siden
> (`forgot-password-page.ts:320` ×2), `checkVerification` efter genstart
> (`VERIFICATION_UNCHECKABLE`) og `verified`-flaget i `session.ts`. Teksten nedenfor er historik.

Tre uafhængige reviews af bølge 0 (HTTP-kerne + auth/session) gav 24 fund. **Ingen af dem er rettet endnu**: rettelsesrunden blev stoppet, før den startede. Reviewerne kan tage fejl, så verificér hvert fund mod koden, før det rettes.

## Arkitektur, i18n og ponytail

### Resumé

Wave 0 mostly complies with ARCHITECTURE.md and CLAUDE.md. I found no critical problems, just 9 minor ones.

**What I verified myself:**

- Tests: `npx ng test --watch=false` gives 95 files and 775 tests, all green.
- Types: `tsc -p tsconfig.spec.json` is clean, so there are no unused locals.
- Dependency direction: no core→shared/features, shared→features or feature→feature imports.
- No `any`, and no hardcoded HTTP status numbers in production code (`HttpStatusCode` is used throughout).
- i18n: da.json and en.json have exactly the same keys. Every key used in templates and TS exists in both, and no key in the touched sections is unused.
- No hardcoded user-facing text in the changed templates or TS.
- SCSS: the only change is the BEM rename `__change`→`__leave`. It uses tokens only.
- Every changed component is OnPush and uses signal inputs and outputs.
- No stale references remain to `AUTH_API_DELAY_MS`, `NO_BACKEND`, `completeSignup`, `markEmailVerified`, `RESET_CODE_LENGTH`, `auth-error.ts`, `submitError`, "4 cifre", "8 tegn" or "Ændre mail", except the README that documents the deviation.
- READMEs are present and accurate, including the new `core/interceptors/README.md` and `core/services/session-data/README.md`.

**The 9 findings fall into four groups:**

- **Error handling:**
  - An empty password at login shows "Noget gik galt" (I checked this against the Docker API).
  - `toApiError` swallows errors that aren't HTTP errors without logging them.
  - The automatic login after a password reset fails silently.
  - "Tjek igen" reports a false negative after an app restart.
- **A trap in the SessionDataService contract:** when an account is deleted, the store `reset()` effect runs after `clearAll()`.
- **Dead code / ponytail:** `ProblemDetails`/`ValidationProblemDetails` are unused, `SessionState.userId` is saved but never read, and `isEmailVerified` is a duplicate alias.
- **Duplicated logic and a documentation rule break:** `auth-mapping.ts` repeats `NutritionCalculator` code, and the utils README example that other waves will copy uses a magic 409.

### Fund

- **[minor]** `mobilapp/src/app/features/auth/pages/login-page/login-page.ts:74`
  - Problem: `submit()` ignores whether the form is valid, even though both controls have `Validators.required`. I tested against the Docker API: `{email:'x@example.test', password:''}` returns 400 with `errors.Password`. `loginErrorKey` only maps 400 for `email`, so it returns null and the user sees the generic 'Noget gik galt. Prøv igen.' (`common.error.requestFailed`). The error state is not understandable (ARCHITECTURE §8/§11).
  - Forslag: Guard before the call: `if (this.loading() || this.form.invalid) { return; }`. Also, or instead, make `loginErrorKey` return `AUTH_ERROR_MESSAGE_KEY.INVALID_CREDENTIALS` for any 400 whose `fields` include `'password'`.

- **[minor]** `mobilapp/src/app/core/utils/api.ts:44`
  - Problem: `toApiError` silently turns any error that isn't an `HttpErrorResponse` into `common.error.requestFailed`, with no log. A programming error (for example a TypeError in `SessionService.login()`'s `map` callback, or in any later store's mapping) reaches the page's error handler, becomes 'Noget gik galt' and leaves no trace. ARCHITECTURE §11 says errors must not be hidden, and logs must carry enough to debug.
  - Forslag: In that branch, log before returning the generic key, e.g. `console.error('Unexpected non-HTTP error', error); return { messageKey: API_ERROR_MESSAGE_KEY.REQUEST_FAILED };`. It holds no tokens or personal data, because HTTP bodies never take this path.

- **[minor]** `mobilapp/src/app/features/auth/pages/forgot-password-page/forgot-password-page.ts:320`
  - Problem: `logInWithNewPassword` handles errors with `error: () => void this.router.navigateByUrl(APP_PATH.LOGIN)`. That is a silent catch. Scenario: the network drops after a successful reset. The user lands on /login with no message. For a guest who has never logged in, the e-mail field is also empty, because `session.email()` is null and nothing writes the step-1 e-mail anywhere. The user isn't told that the password has in fact been changed.
  - Forslag: Keep the user on the 'done' step and set `this.errorKey.set(toApiError(error).messageKey)` so `message()` shows it, next to the existing login link. At minimum, show the error before redirecting instead of discarding it.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:107`
  - Problem: When the password isn't in memory (the app was restarted after signup), `checkVerification()` returns `of(false)`. The sheet then says 'Ikke bekræftet' forever, even if the user has already verified, e.g. from another device. The map (§5.2) asked for a hint or a route to login, not a false negative. The README just documents the wrong answer.
  - Forslag: Use the fallback `verifyEmail()` already has: `if (email === null || this.pendingPassword === null) { this.signOut(); void this.router.navigateByUrl(APP_PATH.LOGIN); return of(false); }`. The login form is prefilled with the e-mail, and logging in is the only way to check. Update verify-email-sheet/README.md to match.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:167`
  - Problem: `deleteAccount()` does `this.state.set(GUEST)` and then `storage.clearAll()`, with a comment saying the resets happen first so nothing can write back. That is no longer true. The status change schedules `SessionDataService`'s effect, which calls `reset()` on every registered store after `clearAll()` and before the reload finishes. Wave 1 stores follow the existing 'persist on every change' pattern, so any `reset()` that writes to storage recreates keys after an account deletion.
  - Forslag: Drop `this.state.set(GUEST)` in `deleteAccount()`. The reload restores a guest from the cleared storage anyway, so the effect never fires before `clearAll()`. Also add 'reset() must only clear memory, never write storage' to the `SessionDataStore.reset()` doc and to session-data/README.md, because that contract goes to the parallel wave-1 agents.

- **[minor]** `mobilapp/src/app/core/models/api.ts:14`
  - Problem: `ProblemDetails` and `ValidationProblemDetails` are exported but imported nowhere. `toApiProblem` reads the body through `isRecord`/`Record<string, unknown>`, so both types are dead code (ARCHITECTURE §7). `ValidationProblemDetails` isn't in the plan at all.
  - Forslag: Either type the body reading in `toApiProblem` with them, e.g. narrow with `isRecord(body)` to `Partial<ValidationProblemDetails>` and read `.detail` and `.errors`, or delete `ValidationProblemDetails` and keep only what is used. Update the `api.ts` row in core/models/README.md to match.

- **[minor]** `mobilapp/src/app/core/models/session.ts:20`
  - Problem: `SessionState.userId` is written in `authenticate()` and validated in `restore()`, but nothing reads it. It is dead persisted state. The purpose the map gave it (auth-session-signup §5.3 step 2: 'userId ≠ last userId → clear user-specific local keys') isn't implemented. So when user B logs in after user A has logged out, B gets A's local profile. `login()` only sets `username` when it is empty.
  - Forslag: Either implement the purpose: in `authenticate()`, if the stored `userId` isn't null and differs from `user.userId`, call `profile.resetToDefaults()` (and later the stores' `reset()`). Or remove `userId` from `SessionState`, `GUEST`, `restore()`, the fixtures and the READMEs (ponytail).

- **[minor]** `mobilapp/src/app/core/services/auth-api/auth-mapping.ts:128`
  - Problem: `toRegisterRequest` re-implements logic that already exists in `NutritionCalculator`:
- `intensityFor()` at l.128–133 duplicates `calculator.intensityFor()`, but without the RPE clamp, so an out-of-range RPE falls back to 'moderat' instead of 'haardt'.
- `trainingDays.filter(Boolean).length` at l.44 duplicates `calculator.trainingFrequency()`.
- `PACES.find(...)` at l.65 duplicates `calculator.paceFor()`.

The map said to use `calculator.intensityFor(rpe)?.id ?? TRAINING_FALLBACK_INTENSITY`. ARCHITECTURE §2/§8 says reuse, not duplicate.

- Forslag: Pass the calculator in, e.g. `toRegisterRequest(profile, password, confirmation, timeZoneId, calculator)`, with SessionService injecting `NutritionCalculator`. Then use `calculator.trainingFrequency(profile)`, `calculator.intensityFor(rpe)?.id ?? TRAINING_FALLBACK_INTENSITY` and `calculator.paceFor(profile.pace)?.kgPerWeek ?? null`, and delete the private `intensityFor`.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:70`
  - Problem: `isEmailVerified` is just an alias of `isAuthenticated`. Two public signals now mean the same thing, and its only consumer is `home-page.ts` l.61 / `home-page.html` l.51. That is extra API surface that wave-1 agents have to reason about (core/services/README.md even has to explain that 'isEmailVerified er det samme som isAuthenticated').
  - Forslag: Delete `isEmailVerified` from SessionService. In HomePage, use `protected readonly isAuthenticated = this.session.isAuthenticated;` and `[open]="!isAuthenticated()"`. Remove the sentence from core/services/README.md.

- **[minor]** `mobilapp/src/app/core/utils/README.md:59`
  - Problem: This is the example the wave-1 domain agents are told to follow, and it uses a magic number: `problem.status === 409`. ARCHITECTURE §7 forbids magic numbers, and the real code consistently uses `HttpStatusCode`. Examples get copied, so the rule break will spread.
  - Forslag: Change the example to `problem.status === HttpStatusCode.Conflict ? WEIGHT_ERROR_KEY.DAY_TAKEN : null` and mention the `HttpStatusCode` import from `@angular/common/http`.

## Tests og build

### Resumé

Jeg har kun læst og ikke ændret noget i repoet. Build og test er begge rene. `npx ng build` giver exit 0 uden fejl og uden advarsler; initial bundle er 389 kB. `npx ng test --watch=false` giver 95/95 filer og 775/775 tests grønne, og loggen har hverken advarsler eller NG0-beskeder. i18n-nøglerne i da.json og en.json matcher hinanden, og alle nøgler koden bruger findes.

Specsene dækker det meste af den risikable logik godt:

- **Interceptoren:** bearer kun til vores API og ikke til OFF, refresh før kaldet, single-flight for to samtidige tomme 401'ere, retry kun én gang, og en 401 med body giver ikke refresh (beskyttet af `verify()`).
- **`toApiError`:** alle tre body-former, tom body, status 0, streng-body, 5xx og passthrough.
- **Register-mapping:** hold, ingen træningsdage og null-køn.
- **Session:** restore af den gamle `{isLoggedIn,isEmailVerified}`-form, et udløbet refresh-token, og at der ikke gensendes mail efter register (via `verify()`).
- **Delete-account:** at den lokale oprydning først sker efter svaret, og at en fejl ikke sletter noget.

For at teste hullerne kørte jeg mutationstest på en kopi af appen i en midlertidig kopi. Kopien er slettet igen. Fem mutationer overlevede hele suiten med alle 775 tests grønne:

- **A:** `finalize`, der nulstiller `refreshInFlight`, er fjernet.
- **B:** `token !== null &&` i interceptoren er fjernet.
- **C:** `shareReplay(1)` er ændret til `refCount: true`.
- **E:** `isAuthTokens`-guarden i `restore()` er fjernet.
- **G:** SessionDataService loader også ved `pending-verification`.
- **P:** navigationen til `/login`, når login efter reset fejler, er fjernet.

A er den alvorlige. Ingen test laver to refreshes efter hinanden, så en regression der replayer det første token for evigt, ville ikke blive fanget. I appen ville den gøre alle `/me`-kald døde efter cirka 30 minutters brug. Derudover er der to mindre, konkrete fejl i koden:

- Et register-kald, der altid giver 400, kan nås ved yderpunkter for vægt og mål.
- Stores' `reset()` kører via en effect efter `deleteAccount`'s `clearAll()`, og det er ikke testet.

### Fund

- **[major]** `mobilapp/src/app/core/services/session/session.ts:212`
  - Problem: Nulstillingen af `refreshInFlight` i `finalize` er helt utestet. Hver spec laver højst én refresh pr. TestBed (tjekket med grep og mutation A: uden `finalize` er alle 775 tests stadig grønne). Uden nulstillingen replayer `shareReplay(1)` det første roterede access token for evigt. Efter token nummer to (cirka 30 min) giver alle kald 401, og retry sender samme døde token igen, så brugeren sidder fast til appen genstartes. En refresh, der fejler på netværket, må heller ikke blive hængende i cachen, og det er heller ikke testet.
  - Forslag: Tilføj i `session.spec.ts` under `describe('tokens')`: `it('starts a new refresh with the rotated token once the previous one has finished', async () => { const { session, http } = setup(EXPIRING_SESSION); const first = firstValueFrom(session.refresh()); http.expectOne('/api/v1/auth/refresh').flush({ ...ROTATED, accessTokenExpiresAt: EXPIRING_SESSION.tokens!.accessTokenExpiresAt }); await first; const second = firstValueFrom(session.accessToken()); const req = http.expectOne('/api/v1/auth/refresh'); expect(req.request.body).toEqual({ refreshToken: 'rotated-refresh-token' }); req.flush({ ...ROTATED, accessToken: 'second-access-token', refreshToken: 'second-refresh-token' }); await expect(second).resolves.toBe('second-access-token'); });`. Tilføj også en variant, hvor den første refresh får `.error(new ProgressEvent('error'))`, og hvor `refresh()` derefter skal lave en ny request.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:215`
  - Problem: Det er med vilje, at `shareReplay(1)` er uden refCount: en refresh skal gøres færdig og gemme de roterede tokens, selv om den eneste subscriber (en komponent med `takeUntilDestroyed`) unsubscriber midt i den. Ellers har serveren roteret R1 til R2, mens klienten stadig har R1, der nu er Used. Næste refresh giver så 401, og brugeren logges ud. Mutation C (`refCount: true`) overlever hele suiten.
  - Forslag: Tilføj i `session.spec.ts`: `it('keeps the rotated tokens when every caller unsubscribes mid-refresh', () => { const { http } = setup(EXPIRING_SESSION); const session = TestBed.inject(SessionService); session.refresh().subscribe().unsubscribe(); http.expectOne('/api/v1/auth/refresh').flush(ROTATED); expect(stored()?.tokens?.refreshToken).toBe('rotated-refresh-token'); });`. Med refCount kaster `flush` "Cannot flush a cancelled request".

- **[minor]** `mobilapp/src/app/core/interceptors/auth.interceptor.ts:38`
  - Problem: Grenen `token !== null` er utestet. Testen 'adds no bearer without a session' flusher aldrig en 401. Mutation B (grenen fjernet) overlever: en tom 401 til en guest eller pending-bruger ville så kalde `session.refresh()` og få `NO_SESSION` (en ApiError) i stedet for den oprindelige HttpErrorResponse. Testen 'retries only once' tjekker heller ikke, at sessionen overlever den anden 401 efter en vellykket refresh.
  - Forslag: Tilføj i `auth.interceptor.spec.ts`: `it('passes an empty 401 on untouched when there is no token', async () => { const { client, http } = setup(PENDING_SESSION); const response = firstValueFrom(client.get(ME)); http.expectOne(ME).flush(null, EMPTY_401); await expect(response).rejects.toBeInstanceOf(HttpErrorResponse); });` (`verify()` i afterEach viser, at der ikke kom en refresh). Tilføj også i 'retries only once': `expect(session.isAuthenticated()).toBe(true); expect(navigate).not.toHaveBeenCalled();`.

- **[minor]** `mobilapp/src/app/core/services/session-data/session-data.ts:39`
  - Problem: Den bindende M8-kontrakt siger, at stores kun loader ved `authenticated` og aldrig ved `pending-verification`. Den er ikke testet: mutation G (`status !== 'guest'`) overlever. Det er heller ikke testet, at en token-refresh (hver 15. min) hverken annullerer eller genstarter loads. Den adfærd hviler alene på, at `status` er en dedupliceret `computed`. Det er den service, alle domæner i bølge 1 bygger på.
  - Forslag: Tilføj i `session-data.spec.ts`: (1) `it('neither loads nor resets while the e-mail is unverified', () => { const { store } = setup(PENDING_SESSION); expect(store.loads).toBe(0); expect(store.resets).toBe(0); });`. (2) En test med `setup({ ...AUTHENTICATED_SESSION, tokens: { ...AUTHENTICATED_SESSION.tokens!, accessTokenExpiresAt: <TEST_NOW + 30s> } })`: kald `session.refresh()`, flush TEST_AUTH_RESPONSE, kør `TestBed.tick()` og forvent `store.loads === 1` og `store.cancelled === 0`.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:243`
  - Problem: `restore()` er kun testet med gyldige former, den gamle form og et udløbet refresh-token. Mutation E (`isAuthTokens`-guarden fjernet) overlever. En gemt `{status:'authenticated', email, userId:1, tokens:null}` eller et token-objekt, der mangler felter, ville så give en TypeError i `parseApiDateTime` allerede i konstruktøren, og appen ville ikke kunne starte. `pending-verification` uden e-mail er heller ikke testet.
  - Forslag: Tilføj i `session.spec.ts` under `describe('restore')`: `it.each([{ status: 'authenticated', email: TEST_EMAIL, userId: 1, tokens: null }, { status: 'authenticated', email: TEST_EMAIL, userId: 1, tokens: { accessToken: 'a' } }, { status: 'authenticated', email: TEST_EMAIL, tokens: AUTHENTICATED_SESSION.tokens }, { status: 'pending-verification', email: null }])('treats a malformed stored session %j as a guest', (stored) => { const { session } = setup(stored); expect(session.status()).toBe('guest'); });`.

- **[minor]** `mobilapp/src/app/features/auth/pages/forgot-password-page/forgot-password-page.ts:320`
  - Problem: At en fejlet login efter reset sender brugeren til `/login` er en af agentens egne beslutninger ud over planen, men den er utestet: mutation P (navigationen fjernet) overlever, og brugeren ville så sidde fast på trinnet 'done'. Specen har desuden ingen `HttpTestingController.verify()`, selv om kæden forgot → reset → login er følsom over for ekstra kald: et ekstra `password/forgot` revokerer det reset-token, brugeren lige har fået.
  - Forslag: Tilføj i `forgot-password-page.spec.ts` `afterEach(() => TestBed.inject(HttpTestingController).verify());` og testen `it('sends the user to login when the login after the reset fails', ...)`: kør `toCodeStep` og `toPasswordStep`, send, flush reset med 204, kald `settle`, flush `/api/v1/auth/login` med `{ title:'Unauthorized', status:401, detail:'Invalid email or password.' }` og status 401, og forvent `navigate` kaldt med `APP_PATH.LOGIN` og ikke med `APP_PATH.HOME`.

- **[minor]** `mobilapp/src/app/features/signup/pages/signup-page/signup-page.ts:92`
  - Problem: SignupPage's nye fejlvisning (`toApiError(error).messageKey`) og dens dobbelt-submit-guard er utestet på komponentniveau. Signup-page-specen har stadig kun sine 4 oprindelige tests. Kritikkens A6 viser, at et dobbelttryk på register rammer det unikke indeks og giver en 500. Guarden er det eneste værn, men ingen test låser den fast.
  - Forslag: Tilføj i `signup-page.spec.ts` en test, der fylder kladden, går til 'summary', klikker 'Opret konto' to gange og kalder `http.expectOne('/api/v1/auth/register')` (det fejler ved 2 requests). Flush `{ title:'Conflict', status:409, detail:'That username is already in use.' }` med status 409, og forvent at `app-ui-form-error` viser den danske tekst for `core.auth.error.usernameTaken`, og at knappen ikke længere er i loading.

- **[minor]** `mobilapp/src/app/features/signup/services/signup-state.ts:232`
  - Problem: Kanttilfælde i register-mappingen: to input-kombinationer når 'summary' og giver altid 400 `Target weight and change pace must match the selected goal.` med den generiske `registerFailed`-tekst, når brugeren har gennemført alle trin. (a) goal='tabe', weightKg 30–35, højde ≤ 143 cm: `goalWeightBounds` giver [35,36], så målet bliver større end eller lig med vægten, og BMI ≥ 17 er stadig realistisk. (b) goal='tage', weightKg ≥ 200: `clamp(x, 201, 200)` giver 200, så målet bliver mindre end eller lig med vægten, og BMI ≤ 35 er realistisk ved 250 cm. `auth-mapping.spec` tester ikke disse tilfælde, og heller ikke 'hold' med en gammel `pace` eller RPE-grænserne 5 og 7.
  - Forslag: Stram `canContinue` for 'goal-weight', så den også kræver `goal === 'tabe' ? bounded < weightKg : goal === 'tage' ? bounded > weightKg : true`. Tilføj signup-state-tests for weightKg 30 + tabe + heightCm 120 og weightKg 250 + tage + heightCm 250, der begge skal forvente `canContinue() === false`. Tilføj i `auth-mapping.spec`: `map({ goal: 'hold', pace: 'moderat' }).weightChangePerWeek` skal være null, og `map({ trainingRpe: 5 })` og `map({ trainingRpe: 7 })` skal give 'Moderate'.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:170`
  - Problem: `deleteAccount()` kalder `clearAll()` 'last', men SessionDataService kalder først stores' `reset()` i en effect, altså efter `clearAll()` og inden navigationen fra `location.replace` er færdig. En store i bølge 1, hvis `reset()` skriver til localStorage (gap-data som samlings-ikoner eller kcalOverride), vil derfor genskabe nøgler efter kontosletningen. Deletion-testen (session.spec l. 315–336) opretter hverken SessionDataService eller kører `TestBed.tick()`, så den kan ikke fange det. `SessionDataStore`-kontrakten siger heller ikke, at `reset()` ikke må skrive.
  - Forslag: Skriv enten i JSDoc for `SessionDataStore.reset()` (og i den README) at 'reset() only clears memory – never writes storage', eller udvid delete-testen med `{ provide: SESSION_DATA_STORES, useValue: [storeWhoseResetWrites] }` + `TestBed.inject(SessionDataService)` og `TestBed.tick()` efter `await done`, og assert stadig `storage.data.size === 0`. Hvis testen fejler, skal oprydningen flyttes, så den sker efter effecten (f.eks. `afterNextRender` eller `queueMicrotask` før `clearAll()`).

- **[minor]** `mobilapp/src/app/core/testing/global-test-providers.ts:25`
  - Problem: `HttpClientTestingBackend` er nu global, men kun session-, session-data-, interceptor-, auth-api- og verify-email-specsene kalder `verify()`. Login-page, forgot-password, signup-state, signup-page, profile-page, home-page og app-integration laver rigtige (test-)HTTP-kald uden `verify()`. Et ekstra kald til en anden URL passerer derfor ubemærket, f.eks. et `resend-verification` efter register, som ugyldiggør den første token (critic §5.1), eller et ekstra forgot.
  - Forslag: Tilføj `afterEach(() => TestBed.inject(HttpTestingController).verify())` i de nævnte specs, eller én gang globalt via en `setupFiles`-fil i test-target'et i `angular.json`, så alle HTTP-specs automatisk afviser uventede requests.

## Korrekthed og sikkerhed

### Resumé

I reviewed wave 0 read-only for correctness and security of auth, session and the interceptor. I did not edit any repo files. The baseline holds: 95 files and 775 tests pass, the C# DTO field names match `core/models/auth.ts` exactly, no tokens or passwords are logged, and I found no DI cycle. Open Food Facts never gets the bearer, and neither do the anonymous auth endpoints.

Checked live against Docker, with throwaway users that were all deleted afterwards (`DELETE /me` → 204, login afterwards → 401).

- **Concurrent 401s:** three concurrent `GET /me` with a rejected bearer led to exactly one `/auth/refresh`, and all three retries returned 200.
- **Proactive refresh:** a token expiring within 60 s was refreshed once before two concurrent requests.
- **Dead refresh token:** refresh answered 401 with a body. The app became guest and went to `/login`, with no retry loop.
- **API error shapes:** a bad or refresh-token bearer gives 401 with an empty body (no content-type, length 0). `DELETE /me` again with the same bearer gives an empty 401. Refresh after delete gives 401 `The account is not active.`
- **Timestamps:** they come with 7 fraction digits, and `parseApiDateTime` handles them. JavaScriptCore (WKWebView) also parses fractions of 1–7 digits.
- **CapacitorHttp on Android:** from reading the native code, an empty 401 becomes `error.error === null` and `application/problem+json` stays text, so `toApiError` still works.

What is wrong is the account lifecycle around switching users and the edges of logout and verify (see findings). Not a code bug: the `ng serve` already running on :4200 (PID 21586, started 08:17) does not use `proxy.conf.json`. POST `/api/v1/*` there gives 404 and GET gives `index.html`, so it must be restarted before any browser test on 4200. I tested on a fresh `npm start` of my own, which I have stopped again.

### Fund

- **[major]** `mobilapp/src/app/core/services/session/session.ts:129`
  - Problem: When a different account logs in on the same device, it inherits the previous account's local profile. `signOut()` (l. 226-229) and `restore()` (l. 255) drop `userId`, so nothing can tell that the account changed. `login()` then only fills in the username when the profile's username is empty (l. 129-131). Verified live: user A logs in, then logs out, then B logs in. `profile().username` stays A's username, and `profile().email`, `weightKg` and `heightCm` also stay A's values. The whole `UserProfile` stays, including `photo` and `kcalOverride`. The profile page shows A's name and e-mail to B, and B's calorie target uses A's local `kcalOverride`. This is a privacy leak on a shared phone, and it breaks the auth report's rule in §5.3 step 2 ('userId ≠ sidst gemte userId → ryd brugerspecifikke lokale nøgler').
  - Forslag: Keep the last account id through sign-out. Persist `userId` (or a new `lastUserId`) in guest and pending states too, in `signOut()` and in `restore()`. In `register()`: if `user.userId` differs from the stored id, clear the previous user's keys (profile reset plus every `STORAGE_KEY` except THEME and LANGUAGE) before the signup profile is written, then store the new id. In `authenticate()`: if a stored id exists and differs from `user.userId`, run `profile.resetToDefaults()` and clear the same keys, then set `username` (and `email`) from `response.user`. Doing the register step first means the new user's own signup profile isn't wiped when they later verify.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:147`
  - Problem: Logout can revoke a refresh token that was already rotated and leave the new one active. The logout body `{ refreshToken }` is read once (l. 147). When `POST auth/logout` gets an empty 401, which happens whenever the proactive check misses (e.g. the device clock is more than 60 s behind the server), the interceptor refreshes (R1 → R2). It then retries the same `HttpRequest` with the old body R1 (interceptor l. 39). Verified live: logout 401 → refresh 200 → logout 204 with R1, and afterwards `POST auth/refresh {R2}` still returns 200. The API sets a Used token to Revoked and answers 204, so R2 stays valid for another 30 days (sliding). There is a related gap: `logout()` does not wait for a reactive refresh already in flight. `refresh()`'s `map` (l. 201-204) calls `authenticate()` unconditionally, so if that refresh answers after `signOut()`, the user is authenticated again and it is persisted.
  - Forslag: 1) In `auth.interceptor.ts`, skip the reactive retry for `AUTH_ENDPOINT.LOGOUT`, e.g. with a small `NO_RETRY` set next to `ANONYMOUS_ENDPOINTS`. 2) In `logout()`, first wait for `this.refreshInFlight ?? this.accessToken()`. Send the call as `defer(() => this.authApi.logout({ refreshToken: this.state().tokens?.refreshToken ?? '' }))`. On an empty 401, `this.refresh()` once and resend that deferred call, so it reads R2. 3) In `refresh()`'s `map`, only call `authenticate(response)` when `this.state().tokens?.refreshToken === refreshToken`. Otherwise the session ended or changed while the call was in flight, so drop the response and just return `response.accessToken`.

- **[minor]** `mobilapp/src/app/core/services/session/session.ts:88`
  - Problem: The user can get stuck after verify succeeds but the automatic login fails. `verifyEmail()` sends `email/verify` and then switches to `login()`. If verify returns 204 but the login fails (network or 5xx), the sheet shows the error, and the token is now used up. Pressing 'Bekræft' again sends the same token and gets 400. `tokenErrorKey` maps that to `core.auth.error.invalidCode`, so the user reads 'Koden er ugyldig eller udløbet' although the e-mail is verified. 'Gensend kode' is then a silent no-op, because the API sends no mail to an already verified address, so the user waits for a mail that never comes. Only 'Tjek igen' (login with `pendingPassword`) gets them out, and nothing points to it.
  - Forslag: In `SessionService`, remember that verification succeeded, e.g. `private verified = false`, set to true in the verify `switchMap` before `login()`. On the next `verifyEmail()` call with `verified && pendingPassword !== null`, skip `email/verify` and only call `login(email, pendingPassword)`. Alternatively, when verify fails with INVALID_CODE while `pendingPassword` is known, fall back to `checkVerification()` and only rethrow if that returns false.

- **[minor]** `mobilapp/src/app/core/interceptors/auth.interceptor.ts:38`
  - Problem: A 401 that arrives late triggers a second refresh, so 'exactly one refresh' is only true when all 401s land inside the first refresh's round trip. `catchError` always calls `session.refresh()`, and `refreshInFlight` is cleared as soon as that refresh completes (`session.ts` l. 212-214). A request sent with T1 whose empty 401 lands after the first refresh finished rotates the tokens again (R2 → R3). With staggered responses (a slow mobile network, many store loads at start-up), each late 401 adds one more rotation. It isn't fatal, but it is extra work, each rotation widens the logout race in the previous finding, and a spec only covers the simultaneous case.
  - Forslag: Only refresh when the rejected token is still the current one. Add e.g. `currentAccessToken(): string | null { return this.state().tokens?.accessToken ?? null; }` to `SessionService`. In the interceptor: `const current = session.currentAccessToken(); return current !== null && current !== token ? next(withBearer(request, current)) : session.refresh().pipe(switchMap((fresh) => next(withBearer(request, fresh))));`. Add a spec where the second 401 is flushed after the first refresh has been flushed.
