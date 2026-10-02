# Integrationsplan v2 – app + API mod kravspec (bindende)

> **Status 2026-10-01: implementeret.** Alle bølger og UI-testen er færdige og merget på
> `feat/api-integration`. Status, tests, åbne beslutninger og "før produktion" står i `README.md`, de
> resterende API-mangler i `api-gaps.md`. Afsnittene nedenfor er planen, som den blev fulgt.
>
> **Merge med `main` 2026-10-02.** `feat/api-integration` er merget ind i `main` og forenet med Roberts
> brugernavn- og mailændringer (`8563897`). §3 gælder uændret med disse forenede regler (markeret
> _Merge:_ nedenfor): brugernavne følger `UsernameRules` (`^[A-Za-z0-9_-]{3,50}$`, altså stadig intet
> `@`) og slås op uden forskel på store og små bogstaver (`NormalizedUsername`); resend sender højst én
> mail pr. konto pr. minut; uden for Development sendes mails via Roberts `SmtpEmailService` (Resend)
> med teksterne fra `AccountEmails`. Detaljer i `README.md` ("Merge med main").

Kravene står i `kravspec.md`. Hvor `map/*.md`, `map/critic.md` eller `api-gaps.md` siger noget andet
end dette dokument, gælder dette dokument. `map/*.md` er baggrund om koden fra før integrationen, men
ikke om beslutningerne. (Den første plan, `plan.md`, og `wave1-workflow.js` er slettet; de ligger i
git-historikken.)

## 0. Rammer

- **API'et må ændres – minimalt**, og kun hvor kravspec ellers ikke kan opfyldes, eller hvor et flow,
  vi bygger, ellers ville give datatab eller et sikkerhedshul. Alle tilladte API-ændringer står i §3.
  Andre API-ændringer kræver en ny beslutning (skriv dem i `api-gaps.md`).
- **Ponytail**: laveste trin på stigen (YAGNI → genbrug → stdlib/native → én linje → minimum).
  Ingen nye npm- eller NuGet-pakker. Sletning frem for tilføjelse. Validering ved tillidsgrænser,
  sikkerhed og beskyttelse mod datatab forenkles aldrig væk. Bevidste genveje markeres
  `// ponytail: <loft>, <opgraderingsvej>`.
- **App**: `mobilapp/ARCHITECTURE.md` og `mobilapp/CLAUDE.md` gælder (features → shared → core,
  OnPush, signals, BEM, design tokens, strict TS uden `any`, ingen magic strings, API-kald kun i
  services, loading/empty/error, al tekst som nøgler i `src/i18n/da.json` **og** `en.json`, README
  opdateres). Appen bruger ikke Ionic-frameworket; spec'ens "Ionic" = Angular + Capacitor. Tilføj ikke
  Ionic.
- **API**: controllers = HTTP, services = logik, EF Core = data, DTO'er udad, async hele vejen,
  central exception handling. Log aldrig passwords, tokens, e-mails eller brugernavne (heller ikke i
  exception-beskeder, som `GlobalExceptionHandler` logger på Warning).
- Kodekommentarer på engelsk, README/dokumentation på dansk.
- **Browser-testbart**: alt kan UI-testes i en desktop-browser med `npm start` (dev-proxy `/api` →
  `http://localhost:5210`) mod API'et i Docker (`docs/api-integration/docker/compose.yml`,
  Development). Dev-mails lander som filer i `docs/api-integration/docker/outbox/*.txt`.
- `dotnet` findes ikke på værten. API-build, -test og -migrationer kører i
  `mcr.microsoft.com/dotnet/sdk:10.0` (kommandoer i §5.2) og må aldrig skrive `bin/obj` i `API/`.
- **Git**: hvert domæne arbejder i sit eget worktree fra spidsen af `feat/api-integration` på
  branchen `wave<N>/<domæne>` (API: `wave1/api`). Symlink `mobilapp/node_modules` fra hovedtræet
  (`/Users/janick/Documents/GitHub/FitnessApp/mobilapp/node_modules`); virker build/test ikke med
  symlink, så `npm ci`. Conventional Commits på dansk (`feat(weight): …`), **ingen Co-Authored-By
  eller anden AI-attribution**, **aldrig push**. Orkestratoren merger (§4.4).
- App-test: `cd mobilapp && npx ng test --watch=false` og `npx ng build` (ingen fejl, ingen
  advarsler). HTTP-specs bruger `provideHttpClient()` + `provideHttpClientTesting()` +
  `HttpTestingController` og kalder `verify()`.
- Gamle lokale data migreres ikke til API'et.

## 1. Dækning af kravspec

API ✔ = findes i dag. `A<n>` = API-ændring i §3. Domæner: se §4.

| UC                     | Emne                                                       | API                             | App-domæne (bølge)               | Note                                                      |
| ---------------------- | ---------------------------------------------------------- | ------------------------------- | -------------------------------- | --------------------------------------------------------- |
| 1.0                    | Registrér                                                  | ✔ + A1 (brugernavn uden `@`)    | auth (2), profile (1: `MIN_AGE`) | Alder 13–100 (P8)                                         |
| 1.1                    | Validér e-mail via link, modal lukker selv                 | A2, A1 (403)                    | auth (2)                         | Login-polling (P1)                                        |
| 1.2                    | Log ind: brugernavn/e-mail, aktiv, lockout                 | A1                              | auth (2)                         | 5 forsøg / 15 min                                         |
| 1.3                    | Log ud                                                     | ✔                               | –                                | Token markeres `Revoked` (P22)                            |
| 1.4                    | Glemt adgangskode: e-mail/brugernavn, link til side        | A3                              | auth (2)                         | Side hostes af API'et (P4)                                |
| 1.5                    | Forny refresh token ved app-start, ikke hvis udstedt i dag | A4                              | auth (2)                         | UTC-dag (P3)                                              |
| 1.5b                   | Forny access token                                         | ✔                               | ✔ (bølge 0)                      | Kun kommentarer rettes                                    |
| 2.0                    | Opdatér e-mail                                             | A5                              | profile (1)                      | Gammel adresse aktiv til linket (P5)                      |
| 2.1–2.3, 2.5, 2.7, 2.8 | Profilfelter + mål                                         | ✔                               | profile (1)                      | Genberegning på serveren                                  |
| 2.4                    | Profilbillede                                              | A10 (kun Development)           | profile-extras (3)               | Beskæring bages ind; 4a = filen kan ikke læses (P10)      |
| 2.6                    | Skridt fra Health Connect/Apple Health                     | ✔ (`StepsIntegration`)          | step-sync                        | Bygget (`tasks/health.md`)                                |
| 3.0                    | Manuel madvare                                             | ✔ (+A6)                         | food (2)                         | Portion → per 100 i appen, loft pr. logning (P12)         |
| 3.1                    | Stregkode                                                  | ✔ (OFF i klienten)              | food (2)                         | "Ikke fundet" → 3.0-formularen                            |
| 3.2                    | Log madvare/samling + måltidstype                          | A6                              | food (2), collections (3)        | `mealType` (P11)                                          |
| 3.3                    | Redigér mængde                                             | ✔                               | food (2)                         | Kun mængde – makroredigering slettes (P12)                |
| 3.4                    | Fjern med bekræftelse                                      | ✔                               | food (2)                         | Fælles `ui-confirm-sheet`                                 |
| 4.0–4.2                | Madsamlinger                                               | ✔                               | collections (3)                  | Min. 1 vare, redigering som diff (P13)                    |
| 5.0                    | Kaloriemål                                                 | ✔ (GoalCalculator)              | profile (1)                      | Kun API-målet; månedlig = ved app-åbning (P7)             |
| 5.1                    | Makromål                                                   | ✔ (30/40/30)                    | profile (1)                      |                                                           |
| 5.2–5.5                | Hjem: i dag, 7 dage, "hele måneden"                        | ✔                               | home (3)                         | Rullende 7 dage + ark med seneste 30 dage (P15)           |
| 6.0                    | Registrér vægt, spørg ved overskrivning                    | ✔ (409 + id)                    | weight (2)                       | (P16)                                                     |
| 6.1–6.3                | Seneste vægt, redigér, graf 1u/3u/3m                       | ✔                               | weight (2)                       | 3 uger (P16)                                              |
| 7.0                    | Historik med løbende indlæsning                            | A7                              | history (3)                      | `/me/history`; registreringsmålet skjules (P17)           |
| 8.0–8.1                | Påmindelser                                                | – (bruges ikke)                 | profile-extras (3)               | Lokale notifikationer (P18)                               |
| 9.0                    | Slet konto                                                 | ✔                               | ✔ (bølge 0)                      |                                                           |
| 9.1                    | Download mine data                                         | A8                              | profile-extras (3)               | Kortlivet download-link (P19)                             |
| 9.2                    | Træk samtykke tilbage                                      | ✔                               | profile-extras (3)               | Én statisk række; 3a springes over; 3b = slet konto (P20) |
| NFR                    | Dansk og engelsk                                           | mails/sider tosprogede (A2, A3) | alle                             | i18n-nøgler                                               |
| NFR                    | Forståelige fejlbeskeder                                   | status + felter (ingen koder)   | alle                             | Status/felt → i18n (P6)                                   |
| NFR                    | Ingen uventet udlogning på 30 dage                         | ✔ + A4                          | auth (2)                         |                                                           |
| NFR                    | Stregkode ≤ 2 s, API ≤ 300–500 ms                          | ✔ (målt 1–40 ms)                | –                                | Manuel måling i UI-test                                   |
| NFR                    | Migrations                                                 | én ny migration (§3)            | –                                |                                                           |
| NFR                    | Ingen logning af følsomme data                             | regler i §0/§3                  | –                                | `Microsoft.AspNetCore` bliver på Warning                  |
| NFR                    | Lagdelt, kodestandarder                                    | A11 (døde klasser slettes)      | –                                | Postgres-navneafvigelser dokumenteres (P22)               |
| Accept                 | Konto-acceptkriterier                                      | ✔                               | auth (2)                         |                                                           |

## 2. Produktbeslutninger

Defaults – Janick kan ændre dem (åbne spørgsmål i §7).

- **P1 E-mailverifikation.** Mailen har et link til en API-side (`GET`), der verificerer og siger
  "gå tilbage til appen". Mens modalen er åben, logger appen ind med adgangskoden i hukommelsen hvert 5. sekund og ved `visibilitychange` (visible). 200 lukker modalen. "Send mail igen" = den
  eksisterende resend, som ugyldiggør ældre links. Ventetilstanden gemmes kun i hukommelsen: efter en
  genstart er brugeren gæst, logger ind, får 403 og ser modalen igen (6a). Token-indsætning og "Tjek
  igen" slettes. _Hvorfor:_ ingen deep links (native opsætning, ikke browser-testbart) og intet
  status-endpoint (åbner for enumeration). Vi genbruger login.
- **P2 Login.** Ét felt, "E-mail eller brugernavn". Indeholder værdien `@`, er det en e-mail
  (små bogstaver); ellers et brugernavn (præcis match, som det unikke indeks). Brugernavne må derfor
  ikke indeholde `@`. Adgangskoden tjekkes før aktiveringen. Rigtig adgangskode + ikke verificeret → 403. Lockout: højst 5 forsøg pr. 15-minutters vindue (fast vindue fra første forsøg), pr. konto
  (ukendte identifikatorer pr. værdi); det 6. afvises med 429, også med rigtig adgangskode. Hvert
  forsøg tælles **atomisk før** adgangskodetjekket (`Interlocked` på en `StrongBox<int>` i
  `IMemoryCache`) – et læs-så-skriv-tal lader parallelle forsøg (hvert ~50 ms PBKDF2) snyde sig forbi.
  Rigtig adgangskode fjerner tælleren (derfor tæller 403 og polling ikke), og det gør en nulstillet
  adgangskode også. `// ponytail:` gælder pr. API-instans og nulstilles ved genstart.
- **P3 Refresh.** Er refresh-tokenet udstedt samme UTC-dag, returnerer API'et **det samme**
  refresh-token og et nyt access-token; ellers roteres som i dag (nyt token, 30 dage). Appen kalder
  `refresh()` én gang ved app-start, når en gendannet session er `authenticated`.
- **P4 Glemt adgangskode.** Identifikator = e-mail eller brugernavn. Mailen linker til en minimal
  HTML-formular hostet af API'et (ny adgangskode to gange), som poster tilbage til API'et. Appens side
  skrumper til ét felt + "Send link" + den neutrale besked. Ingen JavaScript på siden.
- **P5 E-mailskift.** Den nye adresse gemmes på verifikations-tokenet (`NewEmail`). Den gamle
  adresse og sessionen er aktive, indtil linket i mailen til den nye adresse trykkes; så skiftes
  adressen. _Hvorfor:_ i dag deaktiverer et skift hele kontoen, og en tastefejl låser brugeren ude af
  sine data for altid (datatab). Spec'en kræver kun, at den nye adresse er ikke-verificeret, til den er
  valideret.
- **P6 Fejlbeskeder uden fejlkoder.** Spec'en kræver _forståelige fejlbeskeder_, ikke koder, så API'et
  får ingen `code`. Appen mapper status + valideringsfelter (+ endpoint) til i18n. Den eneste
  tvetydighed – de to 409'ere fra `POST auth/register` og `PATCH me` – skelnes som i dag på
  `detail`-teksten (`/username/i` i `registerErrorKey`, testet); API-teksterne "That username is
  already in use." og "An account with that email already exists." ændres ikke. Tomme 401'ere (JWT)
  forbliver tomme, fordi interceptoren bruger "tom 401 = refresh". Tilføj en kode, når en ny UI-gren
  har brug for den.
- **P7 Kaloriemål = API'ets mål, intet andet.** `kcalOverride`, den adaptive justering og appens egen
  BMR/TDEE-formel slettes (ikke i spec'en; override kan komme under sikkerhedsgrænsen). Makroer =
  API'ets gram (30/40/30 af det mål-justerede kaloriemål). "Informér ved minimumsgrænse" afgøres i
  appen: `targetDailyCalories === 1500` (mand) / `1200` (øvrige) → "sikkert minimum". "D. 1. i hver
  måned" = `POST me/goals/recalculate` ved hver indlæsning af profilen (ændrer kun noget, hvis tallene
  har flyttet sig). Ingen scheduler.
- **P8 Aldersgrænse 13–100** – API'ets regel. Appens `MIN_AGE` 16 → 13, og teksten interpolerer
  konstanten. (Vil PO have 16: én linje i `API/Utilities/ProfileValidation.cs` + `MIN_AGE`.)
- **P9 Profil uden lokale ekstraer.** Træning: antal dage ↔ de første N ugedage, intensitet
  Low/Moderate/High ↔ RPE 3/6/9. Enheder (metrisk/imperial) slettes (intet i appen konverterer). Tema
  og sprog forbliver enhedsindstillinger. Ingen tidszone-sync (register gemmer allerede enhedens
  zone).
- **P10 Profilbillede.** Beskæringen bages ind i en 512×512 JPEG (canvas) ved "Brug billedet" og
  uploades. Luk uden at bekræfte = fortryd. 4a ("overholder ikke kravene") = filen kan ikke læses som
  billede i klienten (`readImage` afviser) → den eksisterende `readError`-nøgle med ny tekst. API'ets
  400 kan ikke nås fra appen (uploaden er altid en gen-kodet JPEG under 2 MB) og giver den generelle
  gem-fejl. I Development gemmer API'et billeder lokalt (A10), så flowet kan testes uden den rigtige
  Azure-container.
- **P11 Måltidstype.** `FoodLog.MealType` (Breakfast/Lunch/Dinner/Snack). `consumedAt` = nu.
  Måltid-som-klokkeslæt (`meal-slot.ts`) bygges aldrig. Labelen "Frokost" beholdes for Lunch.
- **P12 Mad.** Manuel madvare pr. portion mappes i appen til API'ets per-100-værdier (g/ml præcist;
  stk/portion via en syntetisk serving på 100 g, `// ponytail:`). Stregkodeopslag forbliver
  Open Food Facts i klienten; en scannet vare oprettes som brugerens private madvare, når den logges.
  Scannerens "ukendt vare"-formular slettes; "ikke fundet" fører til den fulde 3.0-formular.
  Redigering af en logning ændrer kun mængden (3.3): makroredigering af en egen madvare under
  redigeringen slettes (ikke i spec'en, og `PATCH foods` + `PATCH food-logs` parallelt kunne gemme de
  gamle makroer). Loft pr. logning: højst 9999 kcal og 999 g pr. makro, så `FOOD_LOG`s
  `numeric(7,2)` aldrig flyder over (i dag en 500).
- **P13 Samlinger.** En logget samling = N almindelige madlog-rækker (API'ets opførsel) under den
  valgte måltidstype, hver for sig redigerbar/fjernbar. Ingen multiplikator. Redigering = diff i
  appen (PATCH navn, POST nye varer, DELETE fjernede, GET). Ikon, måltid på samlingen, systemsamlinger,
  opskrifter og løse varer slettes (ikke i spec eller API).
- **P14 Bekræftelser.** `features/collections/components/delete-collection-sheet` flyttes til
  `shared/components/ui-confirm-sheet` og bruges til 3.4 og 4.2.
- **P15 Hjem.** "Seneste 7 dage" = rullende (i dag − 6 … i dag). "Åbn mere" = et ark med de **seneste
  30 dage** (rullende som ugen, nyeste øverst, dag · kcal/mål · P/K/F), ingen månedsnavigation.
  _Hvorfor ikke kalendermåneden:_ d. 1.–6. ville arket vise færre dage end ugen. Data fra
  `FoodLogService.dailyTotals` (90 dage indlæst). I dag viser 0, når madloggen er indlæst. Fejler mad-,
  vægt- eller profil-storen → besked + "Prøv igen". Fejringen starter først, når mad og profil er
  indlæst (ellers fejres et allerede nået mål ved hver app-start).
- **P16 Vægt.** Altid `POST` først; 409 → overskrivningsark med `existingWeightLogId` → "Ja" =
  `PATCH`. Graf 1 uge / **3 uger** / 3 måneder. Uden vejninger vises startvægten med teksten
  "Startvægt fra registreringen". Alle viste vejninger kan rettes og slettes (startvægten er aldrig en
  række). `weightKg` sættes af profilens load (`GET me/weight-logs/latest`); vægt-storen henter kun
  listen og holder `weightKg` ajour efter mutationer (nyeste vejning, eller `GET latest`, når ingen er
  tilbage).
- **P17 Historik** fra `GET me/history` med payload (A7), 50 pr. side, næste side ved scroll nær bunden,
  filtre sendes som `types`. `AchievementCompleted` vises ikke (præstationer er lokale). Hver
  `GoalUpdated` vises, som den er – undtagen registreringens første mål (samme `occurredAt` som
  `AccountCreated`, API'et opretter dem med samme `now`), så en ny konto kun viser "Konto oprettet"
  (7.0). Kun appen; API'et er uændret.
- **P18 Påmindelser** forbliver enhedslokale (localStorage + `@capacitor/local-notifications`). Ingen
  `/me/reminders`, ingen push/Firebase. Hovedkontakten gemmes som `SettingKey.Notifications`.
- **P19 Dataeksport.** `POST me/data-export/token` giver et token (5 min), og appen navigerer til
  `GET /api/v1/data-export?token=…` (attachment). Tokenet står i query-strengen, ikke i stien, fordi
  `GlobalExceptionHandler` logger `Request.Path` ved 5xx. Browseren downloader; på native åbner
  Capacitor systembrowseren, som gemmer filen. Nødvendigt, fordi Capacitor-WebViews ikke kan gemme
  blobs, og Filesystem/Share ville være nye pakker.
- **P20 Samtykke.** Register giver kun `Terms`; `HealthDataProcessing` gives aldrig, `StepsIntegration`
  springes over (9.2-3a), og tilbagetrækning af `Terms` sletter kontoen. Oversigten er derfor **én
  statisk række** "Servicevilkår og behandling af sundheds- og profildata · Træk tilbage" (ingen
  `GET me/consents`). Tilbagetrækning = det eksisterende `POST me/consents/Terms/withdraw`, der
  sletter kontoen (spec 3b), efter bekræftelse i det ikke-lukbare slet-ark. Signup-teksten præciserer,
  at vilkårene omfatter behandling af sundheds- og profildata.
- **P21 Præstationer** er ikke i spec'en: de afledes fortsat lokalt af API-data. Achievement-endpoints
  bruges ikke.
- **P22 Uændret/dokumenteret:** Log ud markerer refresh-tokenet `Revoked` (funktionelt = fjernet).
  `POST auth/email/verify` beholdes til scripts/tests. CORS springes over (dev-proxy i browseren,
  CapacitorHttp på native; de nye sider er same-origin). Postgres-afvigelserne
  (`REFRESH_TOKEN.TokenId` = jti, `PASSWORD_RESET_TOKEN.TokenId` = hash, `FOOD.CreatedByUserId` =
  rollebaseret FK) dokumenteres og omdøbes ikke.
- **P23 Springes over:** ~~2.6 og 9.2-3a (Health Connect/Apple Health: nye native pakker, ikke
  browser-testbart)~~ – senere bygget efter beslutning (`tasks/health.md`, ét plugin:
  `@capgo/capacitor-health`; API'et uændret), push/Firebase, deep links, offline-kø, idempotens-nøgler, tidszone-sync,
  makrofordeling pr. måltype, rotation af committede hemmeligheder og SAS i `profileImageUrl`
  (ops-opgaver, se §7), lockout på forgot/resend.

## 3. API-kontrakt (bindende – app-agenter bygger op imod den parallelt)

JSON er camelCase, enums som strenge. Fejl fra `GlobalExceptionHandler`: `application/json`
`{ title, status, detail }` (+ `existingWeightLogId` ved vægt-409). Model-validering:
`application/problem+json` `{ title, status, errors: { <Felt>: [...] } }`. JWT-401 og routing-404/405:
tom body.

**Migration:** én migration, `AddMealTypeAndPendingEmail`:
`FOOD_LOG.MealType integer NOT NULL DEFAULT 4` (Snack; EF's scaffoldede `0` rettes til `4`) og
`EMAIL_VERIFICATION_TOKEN.NewEmail varchar(320) NULL`. _Merge:_ fra `main` kommer Roberts
`BindEmailVerificationTokensToEmail` (`EMAIL_VERIFICATION_TOKEN.Email`, ugyldiggør gamle tokens) og
`AddNormalizedUsername` (genereret `USER.NormalizedUsername` + unikt indeks).

**Konfiguration:** `App:PublicBaseUrl` (env `App__PublicBaseUrl`) – API'ets absolutte URL, som
brugerens browser når den. `appsettings.json`: `""`; `appsettings.Development.json`:
`"http://localhost:5210"`. Valideres med options-mønstret (`AppOptions`, `Validate` absolut
http/https-URI + `ValidateOnStart`), så `dotnet ef` ikke påvirkes. Links bygges **kun** herfra, aldrig
fra `Request.Host` (`AllowedHosts` er `*` → host-header-forgiftning af reset-links).

### A1 Login med e-mail eller brugernavn, 403, lockout

`POST /api/v1/auth/login`

```json
{ "emailOrUsername": "string (1–320)", "password": "string (1–200)" }
```

| Status | Hvornår                                                                                                                            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 200    | `AuthResponse` (uændret)                                                                                                           |
| 400    | valideringsfejl (`errors.EmailOrUsername` / `errors.Password`)                                                                     |
| 401    | ukendt identifikator, slettet konto, forkert adgangskode, inaktiv konto (samme tekst – siger ikke hvad)                            |
| 403    | rigtig adgangskode, e-mail ikke verificeret (`UnauthorizedAccessException`). Ingen tokens, tæller ikke som fejl                    |
| 429    | 6. forsøg inden for 15-minutters vinduet (fast fra første forsøg). Tælles **før** adgangskoden, så også rigtig adgangskode afvises |

- Opslag (`FindByIdentifierAsync`, genbruges af A2/A3): trim; indeholder `@` → `Email == lower`,
  ellers `Username == trimmed` (præcis). _Merge:_ ellers `NormalizedUsername == Normalize(trimmed)` –
  brugernavne er uden forskel på store og små bogstaver.
- Lockout-nøgle: `login:{userId}` for en kendt konto, ellers `login:{identifier.ToLowerInvariant()}`.
  Tælling (atomisk, før adgangskoden):
  `var attempts = _cache.GetOrCreate(key, e => { e.AbsoluteExpirationRelativeToNow = LockoutWindow; return new StrongBox<int>(); })!;`
  `if (Interlocked.Increment(ref attempts.Value) > MaxFailedAttempts) throw new TooManyRequestsException(…);`
  Rigtig adgangskode fjerner nøglen; `ResetPasswordAsync` fjerner `login:{userId}` efter commit.
  `builder.Services.AddMemoryCache()` (in-box). Ny `TooManyRequestsException` → 429
  `"Too many requests"` i `GlobalExceptionHandler`.
- `RegisterRequest.Username` og `UpdateAccountRequest.Username`: `[RegularExpression("^[^@]+$")]` →
  400 `errors.Username`. _Merge:_ Roberts `UsernameRules.Pattern` `^[A-Za-z0-9_-]{3,50}$` (+
  `UsernameRules.Validate` i servicen); den udelukker også `@`. (Positionelle records: attributten bliver på konstruktørparameteren – MVC
  læser den der, `Validator.TryValidateObject` gør ikke; unit-test reglen på `RegisterRequest`.)

### A2 Verifikationsmail med link, verificér via GET, resend med identifikator

- Mail (ny helper `Utilities/AccountEmails.cs`, erstatter de tre duplikerede tekster):
  emne `Bekræft din e-mail · Confirm your e-mail – Nutrify`, tosproget tekst (da + en, "gælder i
  24 timer") og linket `{PublicBaseUrl}/api/v1/auth/email/verify?token={64 hex}`. Bruges af
  register, resend og e-mailskift (A5).
- `GET /api/v1/auth/email/verify?token=…` (anonym) → `200 text/html` eller `400 text/html` (tekster
  nedenfor). Genbruger `VerifyEmailAsync` (engangs-token). Siderne: statisk HTML,
  `Content-Type: text/html; charset=utf-8`, `<meta charset="utf-8">` + viewport-meta (åbnes på
  telefoner), inline CSS, ingen eksterne ressourcer, al ekko HTML-encodet, headers
  `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`.
- `POST /api/v1/auth/email/verify { token }` → 204/400 **uændret** (dev/tests; appen bruger det ikke).
- `POST /api/v1/auth/email/resend-verification`: body `{ "emailOrUsername": "string (1–320)" }` →
  altid 204. Kun for ikke-verificerede sign-ups; ugyldiggør ældre links (3a). _Merge:_ højst én mail pr.
  konto pr. 60 s (Roberts cooldown); inden for den sendes intet, og det gamle link virker stadig.

### A3 Glemt adgangskode med identifikator, API-hostet nulstillingsside

- `POST /api/v1/auth/password/forgot`: body `{ "emailOrUsername": "string (1–320)" }` → altid 204.
  Mail kun til en eksisterende, aktiv, verificeret, ikke-slettet konto (2a). Ældre reset-tokens
  revokeres (6a); nyt token gælder 1 time. Mail: emne `Nulstil din adgangskode · Reset your password –
Nutrify`, tosproget, link `{PublicBaseUrl}/api/v1/auth/password/reset?token=…`.
- `GET /api/v1/auth/password/reset?token=…` (anonym) → `200 text/html` formular eller `400 text/html`
  ugyldigt link (7a; tekst nedenfor).
  GET **forbruger ikke** tokenet (mail-scannere prefetcher). Ny `IAuthService.IsPasswordResetTokenActiveAsync`.
  Formularen: `<form method="post" action="reset">` (relativ), skjult `token`, `newPassword` og
  `newPasswordConfirmation` (`type=password required minlength=10 maxlength=200
autocomplete=new-password`), teksten "Mindst 10 tegn · At least 10 characters" (9a), knap "Gem · Save".
- `POST /api/v1/auth/password/reset` (`application/x-www-form-urlencoded`: `token`, `newPassword`,
  `newPasswordConfirmation`, bundet som nullable `[FromForm] string?` og valideret i controlleren, så
  `[ApiController]`'s automatiske JSON-400 aldrig rammer en browser og alle udfald er HTML) → `200
text/html` succes; `400 text/html` formularen igen med mismatch- (9b) eller længde-teksten; `400
text/html` ugyldigt link. Succes: tokenet `Used`, alle refresh-tokens `Revoked` (uændret), login-lockout
  for kontoen fjernet. JSON-varianten fjernes.
- Adgangskoderegel overalt: 10–200 tegn, ingen sammensætningskrav. `ResetPasswordRequest` og
  `ChangePasswordRequest` får `MaxLength(200)`; `EnsureMatchingPasswords` tjekker også max 200.

**Tekster i mails og på sider (præcis, med æ/ø/å; da-linje og en-linje):**

| Hvor              | Tekst                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verifikationsmail | "Tryk på linket for at bekræfte din e-mail til Nutrify. Linket gælder i 24 timer." / "Tap the link to confirm your e-mail for Nutrify. The link is valid for 24 hours." · link · "Har du ikke oprettet en konto eller skiftet e-mail, kan du ignorere mailen." / "If you didn't create an account or change your e-mail, you can ignore this mail."                                                                         |
| Reset-mail        | "Tryk på linket for at vælge en ny adgangskode til Nutrify. Linket gælder i 1 time." / "Tap the link to choose a new password for Nutrify. The link is valid for 1 hour." · link · "Har du ikke bedt om det, kan du ignorere mailen." / "If you didn't ask for this, you can ignore this mail."                                                                                                                             |
| Verify 200        | titel "E-mail bekræftet · E-mail confirmed"; "Din e-mail er bekræftet. Gå tilbage til Nutrify-appen." / "Your e-mail is confirmed. Go back to the Nutrify app."                                                                                                                                                                                                                                                             |
| Verify 400        | titel "Ugyldigt link · Invalid link"; "Linket er ugyldigt, udløbet eller allerede brugt. Tryk på 'Send mail igen' i appen, eller log ind, hvis din e-mail allerede er bekræftet. Skiftede du e-mail? Skift den igen under Profil." / "The link is invalid, expired or already used. Tap 'Send e-mail again' in the app, or log in if your e-mail is already confirmed. Changed your e-mail? Change it again under Profile." |
| Reset-formular    | titel "Ny adgangskode · New password"; "Vælg en ny adgangskode til Nutrify." / "Choose a new password for Nutrify."; felter "Ny adgangskode · New password", "Gentag adgangskode · Repeat password"; "Mindst 10 tegn · At least 10 characters"; knap "Gem · Save"                                                                                                                                                           |
| Reset mismatch    | "Adgangskoderne er ikke ens · The passwords do not match"                                                                                                                                                                                                                                                                                                                                                                   |
| Reset længde      | "Adgangskoden skal være 10–200 tegn · The password must be 10–200 characters"                                                                                                                                                                                                                                                                                                                                               |
| Reset 400 link    | titel "Ugyldigt link · Invalid link"; "Linket er ugyldigt, udløbet eller allerede brugt. Bed om et nyt under 'Glemt adgangskode' i appen." / "The link is invalid, expired or already used. Ask for a new one under 'Forgot password' in the app."                                                                                                                                                                          |
| Reset 200         | titel "Adgangskode skiftet · Password changed"; "Din adgangskode er skiftet. Gå tilbage til Nutrify, og log ind." / "Your password has been changed. Go back to Nutrify and log in."                                                                                                                                                                                                                                        |

### A4 Refresh: samme UTC-dag → samme refresh-token

`POST /api/v1/auth/refresh { refreshToken }` → 200 `AuthResponse` / 401 (uændret kontrakt).
`RefreshTokenIdentity` får `IssuedAt` (JWT `nbf`) og `ExpiresAt`. Er `IssuedAt.Date == now.Date`
(UTC) og tokenet `Active` i databasen: nyt access-token, `refreshToken`/`refreshTokenExpiresAt` =
de sendte værdier, ingen ny række. Ellers rotation som i dag. Ingen migration.

### A5 E-mailskift uden deaktivering

`PATCH /api/v1/me { email?, username? }` → 200 `UserDto` med den **nuværende** e-mail og
`isActive: true`; sessionen forbliver gyldig. Er e-mailen ændret: tjek 409, markér brugerens ældre
ubrugte verifikations-tokens brugt, opret et token med `NewEmail` (24 timer) og send A2-mailen til den
**nye** adresse. Deaktivering og revokering af refresh-tokens fjernes. `VerifyEmailAsync`: har tokenet
`NewEmail`, og er adressen stadig ledig, skiftes `User.Email`; ellers 400 (siden fra A2). Gensend =
`PATCH` igen. `GET /me` viser den nye adresse, når linket er trykket. 409 med de uændrede
`detail`-tekster (P6). 400 ved ugyldig adresse eller brugernavn med `@`.

### A6 Måltidstype på madlog

- `enum MealType { Breakfast = 1, Lunch = 2, Dinner = 3, Snack = 4 }` (JSON `"Breakfast"` …).
- `POST /api/v1/me/food-logs`:
  `{ "foodId": int, "quantity": decimal, "unit": QuantityUnit, "consumedAt": "ISO-8601", "mealType": MealType }`
  → 201 `FoodLogDto`. Manglende/`0` → 400 `detail: "Meal type is invalid."`; ukendt navn → 400
  `errors["$.mealType"]`.
- `FoodLogDto` = `{ foodLogId, foodId, foodName, quantity, unit, caloriesConsumed, proteinConsumed,
carbohydratesConsumed, fatConsumed, consumedAt, mealType }` – overalt, hvor den bruges (food-logs,
  collection-log, nutrition history, data-export, historik-payload).
- `PATCH /api/v1/me/food-logs/{id}` uændret (beholder `mealType`).
- `POST /api/v1/me/meal-collections/{id}/log { consumedAt, mealType, multiplier? = 1 }` → 200
  `FoodLogDto[]`, alle med den sendte `mealType`.

### A7 Historik-payload

`GET /api/v1/me/history?types&from&to&limit&cursor` (parametre, sortering og cursor uændret) →
`CursorPage<HistoryEventDto>` med
`{ type, occurredAt, referenceId, foodLog: FoodLogDto | null, weightLog: WeightLogDto | null, goal: UserGoalDto | null }`.
Feltet svarende til `type` er sat for `FoodLogged`/`WeightRecorded`/`GoalUpdated`; `AccountCreated` og
`AchievementCompleted` har alle tre `null`. Hydreres efter paging med højst tre opslag på primærnøgle
(filtreret på `UserId`), og union-forespørgslen røres ikke. `WeightLogDto = { weightLogId, weight,
recordedAt, recordedDate }`, `UserGoalDto` uændret.

### A8 Download af dataeksport

- `POST /api/v1/me/data-export/token` (Bearer) → 200 `{ "token": "string" }` (base64url,
  `ITimeLimitedDataProtector`, formål `FitnessApp.DataExport.v1`, userId som payload, 5 minutter,
  `// ponytail:` genbrugeligt inden for TTL).
- `GET /api/v1/data-export?token=…` (anonym) → 200 `application/json` = `UserDataExportDto`,
  `Content-Disposition: attachment; filename="nutrify-data-YYYY-MM-DD.json"`, `Cache-Control: no-store`;
  404 ved manglende/ugyldigt/udløbet token eller slettet bruger. (Query, ikke sti: `GlobalExceptionHandler`
  logger `Request.Path` ved 5xx.)
- `GET /api/v1/me/data-export` uændret.

### A9 Udgår

Ingen fejlkoder (P6). De to 409-tekster ved de fire throw-steder (`AuthService.RegisterAsync` ×2,
`UserAccountService.UpdateAsync` ×2) ændres ikke – appen skelner dem på `detail`.

### A10 Development: profilbilleder gemmes lokalt

`LocalProfileImageStorage : IProfileImageStorage` (kun Development) skriver til
`{ContentRoot}/.dev-images/{guid}.{ext}` og serveres anonymt af `UseStaticFiles` på
`/api/v1/dev-images/{key}`. `profileImageUrl` bliver da relativ (`/api/v1/dev-images/<guid>.jpg`) og
går gennem dev-proxyen. `PUT/DELETE /api/v1/me/profile/image` og al validering (≤ 2 MB,
JPEG/PNG/WebP via magic bytes, feltet `file`) er uændret. Produktion bruger Azure som i dag.
`.dev-images/` i roden af `.gitignore`.

### A11 Oprydning

Slet de 7 tomme klasser i `API/Controllers` (`AchivementController`, `DashboardController`,
`FoodController`, `FoodLogController`, `MealCollectionController`, `ReminderController`,
`WeightController`; namespace `API.Controllers`, ingen routes). Ret `API/Migrations/README.md`
(`--project API.csproj` + Docker-kommandoen fra §5.2).

### Statuskoder, appen mapper (resumé)

| Endpoint                                                           | Svar, appen skelner                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `POST auth/register`                                               | 201 · 400 felter · 409 (`detail` skelner brugernavn/e-mail)          |
| `POST auth/login`                                                  | 200 · 400 · 401 · 403 (→ modal) · 429                                |
| `POST auth/email/resend-verification`, `POST auth/password/forgot` | 204 (400 kun ved tomt felt)                                          |
| `POST auth/refresh`                                                | 200 · 401 (→ login)                                                  |
| `PATCH me`                                                         | 200 · 400 · 409 (som register)                                       |
| `PATCH me/profile`                                                 | 200 · 400 (felt/alder)                                               |
| `POST me/goals`                                                    | 201 · 400 · 409 (identisk mål = succes)                              |
| `PUT me/settings/Notifications { value: "true" \| "false" }`       | 200                                                                  |
| `POST me/weight-logs`                                              | 201 · 409 `existingWeightLogId` (→ overskrivningsark)                |
| `POST foods`                                                       | 201 · 409 (navn findes) · 400                                        |
| `POST me/food-logs`                                                | 201 · 400 · 404 (madvare)                                            |
| `DELETE me/food-logs/{id}`                                         | 204 · 404 (→ "findes ikke længere")                                  |
| `POST/PATCH/DELETE me/meal-collections[/…]`                        | 201/200/204 · 400 (fx sidste vare) · 404                             |
| `GET me/history`                                                   | 200 · 400                                                            |
| `PUT me/profile/image`                                             | 200 `{ profileImageUrl }` · 400 (krav) · `DELETE` 204/404 (= succes) |
| `POST me/data-export/token` · `GET data-export?token=`             | 200 `{ token }` · 200 attachment / 404                               |
| `POST me/consents/{type}/withdraw`                                 | 204 (Terms/HealthDataProcessing = konto slettet) · 404               |

### Bevidst uændret i API'et

Logout (`Revoked`), achievements, reminders, devices/push, CORS, Postgres-navne, hemmeligheder i `appsettings.json` (ops, §7), SAS i `profileImageUrl` (ops, §7),
`consumedAt`-guard, 23505 → 409, idempotens. Nye fund skrives i `api-gaps.md`.

Senere ændret (efter beslutning): `force:true` ved genberegning er slettet sammen med parameteren
(`4f1e827`), så en vejning eller profilændring kun giver en ny målrække, når tallene ændres. Og
madværdier, der ville løbe over `numeric(7,2)`/`numeric(9,2)`, afvises med 400 (`c2ad5e4`).

## 4. App: bølger, domæner, filejerskab og kontrakter

### 4.1 Bølger

| Bølge   | Domæner (parallelt)                                                          | Afhænger af                               |
| ------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| 1       | `api` (API-agent, §3 + docs) · `profile` (inkl. den fælles app-forberedelse) | –                                         |
| 2       | `auth` · `food` · `weight`                                                   | `profile` merget (ikke `api`)             |
| 3       | `collections` · `home` · `history` · `profile-extras`                        | bølge 2 merget                            |
| UI-test | browser-test af alle use cases (§5.4)                                        | bølge 3 + `api` merget, Docker genstartet |

_Hvorfor `profile` alene først:_ den sletter `STORAGE_KEY.PROFILE`-persistensen, `kcalOverride`, den
adaptive justering og enhederne, som specs i auth, food, weight, home og reminders seeder. Kørte den
parallelt med dem, ville flere domæner omskrive de samme spec-linjer (konflikter eller et rødt træ efter
merge). Den fælles forberedelse (tidligere `core-contracts`) er lagt ind i `profile`, så bølge 1 stadig
kun har to agenter, og kæden ikke bliver længere.

App-agenterne bygger mod §3 med `HttpTestingController` og venter ikke på API-agenten. Ændrede
endpoints testes live først i UI-testen; app-agenterne bruger hverken browseren eller det kørende API.

### 4.2 Filejerskab (hvem må røre hvad)

| Domæne               | Ejer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profile` (1)        | Forberedelse: `core/models/api.ts` (`StoreStatus`), `core/utils/api.ts` (+spec, README: `readProblemBody`), `core/constants/storage-key.ts` (kun `STORAGE_KEY_PREFIX`), `core/services/storage/*`, `core/services/session-data/*`, stubs i `weight-log.ts`, `food-log.ts`, `collections.ts`. Profil: `core/models/profile.ts`, `core/models/nutrition.ts`, nye `core/models/profile-api.ts` + `core/constants/profile.ts`, `core/constants/nutrition.ts`, `core/constants/profile-defaults.ts`, `core/services/user-profile/*`, `core/services/nutrition-calculator/*`, `core/services/adaptive-goal/` (slettes), `features/profile/**` undtagen photo-sheet/reminders-sheet/delete-sheet (photo-sheet kun så den kompilerer), `shared/components/ui-text-input` (`'date'`), kald-linjerne for kcal/makro-mål i `features/home/services/home-summary.ts`, `features/food/services/food-view.ts`, `features/profile/services/achievements.ts`, `toProfile` + `updatePersisted`-kald i `features/signup/**`, **og de linjer i andre specs, der knækker af dens ændringer** (seeder `STORAGE_KEY.PROFILE`, bruger `kcalOverride`/`AdaptiveGoalService`/enheder – fx `session.spec.ts`, `signup-state.spec.ts`, `food-page.spec.ts`, `food-view.spec.ts`, `weight-view.spec.ts`, `weight-page.spec.ts`, `home-summary.spec.ts`, `reminders.spec.ts`, `storage.spec.ts`), i18n `profile.page/rows/edit/editSheet`, `core.nutrition` |
| `auth` (2)           | `core/models/auth.ts`, `core/constants/auth.ts`, `core/services/auth-api/*`, `core/services/session/*`, `core/interceptors/README.md`, `app.config.ts` (én linje), `features/auth/**`, `features/home/components/verify-email-sheet/**`, `features/signup/**` (undtagen `toProfile`), i18n `core.auth`, `auth`, `home.verifyEmail`, `signup.*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `food` (2)           | nye `core/models/food-api.ts`, `core/constants/food.ts`, `core/services/food-log/*` (+ ny `food-log-mapping.ts`), `core/services/food-search/*`, `core/services/barcode-flow/*`, `core/constants/meals.ts`, `core/testing/test-providers.ts` (`FOOD_SEARCH_DELAY_MS` væk), `shared/components/food-picker/**`, `shared/components/barcode-scanner/**`, ny `shared/components/ui-confirm-sheet/**` (flyttet fra `features/collections/components/delete-collection-sheet`), `features/food/**` undtagen kcal-linjerne i `food-view.ts`; minimale kaldstilpasninger i `features/history/services/history.ts`, `features/collections/**` og `food-add-sheet` så build er grønt; i18n `food.*`, `shared.foodPicker`, `shared.barcodeScanner`, `core.barcode`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `weight` (2)         | `core/services/weight-log/*`, `core/models/weight.ts`, `core/constants/weight.ts`, `features/weight/**`, i18n `weight.*`, `core.weight`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `collections` (3)    | `core/services/collections/*`, collection-typer i `core/models/food.ts` og `core/models/food-api.ts`, `core/constants/collection-icons.ts`, `features/collections/**`, samlingsfanen i `features/food/components/food-add-sheet/**`, én linje i `achievements.ts`, oprydning i `core/constants/storage-key.ts` (slet alle ubrugte nøgler), i18n `collections.*`, `core.collectionIcons`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `home` (3)           | `features/home/**` undtagen `verify-email-sheet`, i18n `home.*` undtagen `home.verifyEmail`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `history` (3)        | `features/history/**`, i18n `history.*`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `profile-extras` (3) | `features/profile/components/profile-photo-sheet/**`, `profile-delete-account-sheet/**`, `profile-reminders-sheet/**`, ny `features/profile/services/privacy.ts`, privatlivssektionen i `profile-page`, `shared/components/profile-avatar/photo-crop.ts`, `uploadPhoto/deletePhoto` i `user-profile.ts`, `core/services/reminders/*`, `withdrawConsent` i `session.ts`, privatlivskald i `core/services/auth-api/auth-api.ts` + endpoints i `core/constants/auth.ts`, `ios/App/App/Info.plist` (`NSCameraUsageDescription`), i18n `profile.photoSheet/remindersSheet/deleteAccountSheet/consents`, nye nøgler i `profile.page`, `core.reminders`, `signup.summaryStep.termsEnd`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Fælles filer (`src/i18n/*.json`, `core/services/README.md`, `core/models/README.md`,
`core/constants/README.md`): kun små, lokale indsættelser/ændringer i egne afsnit.

### 4.3 Kontrakter mellem domæner

Fælles kerne fra bølge 0 gælder uændret: `API_BASE_URL` + relative endpoint-konstanter i domænets
`core/constants/*.ts`, `injectApiUrl()`, `CursorPage<T>`, `fetchAllPages()`, `toApiError()`/
`mapApiError()`, interceptoren (Bearer kun til API'et, single-flight refresh, retry én gang),
`SessionService.status` (`guest | pending-verification | authenticated`), **alle `/me/**`-kald venter
på `authenticated`**, `SessionDataService` kalder `load()`/`reset()` på stores i
`SESSION_DATA_STORES`. Stores henter aldrig ved konstruktion, udstiller `status: Signal<StoreStatus>`
og muterer **pessimistisk** (state fra serverens svar). `reset()` rydder kun hukommelse. Stores
injicerer aldrig `SessionService` (den injicerer `UserProfileService` → DI-cyklus). Specs sætter
profiltilstand med `TestBed.inject(UserProfileService).update({…})` (eller flusher profilens load),
aldrig ved at seede `STORAGE_KEY.PROFILE`.

**Bølge 1 – `profile` leverer:**

```ts
// core/models/api.ts
export type StoreStatus = 'idle' | 'loading' | 'ready' | 'error';
// core/utils/api.ts
export function readProblemBody(error: HttpErrorResponse): Readonly<Record<string, unknown>>; // parser også streng-bodies (CapacitorHttp)
// core/constants/storage-key.ts
export const STORAGE_KEY_PREFIX = 'nutrify.'; // StorageService.clearAll(keep) fjerner ALLE nøgler med præfikset
// core/services/session-data/session-data.ts
SESSION_DATA_STORES = [UserProfileService, WeightLogService, FoodLogService, CollectionsService] // weight/food/collections: no-op-stubs indtil bølge 2/3

// UserProfileService (SessionDataStore)
readonly profile: Signal<UserProfile>;        // som i dag, men fra API'et (ikke localStorage); load sætter weightKg fra GET me/weight-logs/latest
readonly status: Signal<StoreStatus>;
readonly goal: Signal<UserGoalDto | null>;
readonly targets: Signal<Macros>;             // afrundet kcal/protein/carbs/fat fra goal; 0 før load
readonly calorieFloorApplied: Signal<boolean>;
load(): Observable<void>;                     // også til "Prøv igen" i andre features
update(patch: Partial<UserProfile>): void;    // synkron, kun hukommelse (vægt: weightKg)
save(patch: Partial<UserProfile>): Observable<void>; // PATCH me/profile (+reloadGoal) | POST me/goals | PUT me/settings/Notifications | PATCH me (email)
reloadGoal(): Observable<void>;               // GET me/goals/current
// core/models/profile-api.ts: UserProfileDto, UserGoalDto, CreateUserGoalRequest, UserSettingDto, LatestWeightDto
// core/services/user-profile/profile-mapping.ts: GOAL_FROM_API: Record<ApiGoalType, GoalId> m.fl.
// core/constants/nutrition.ts: MIN_AGE = 13, CALORIE_FLOOR_KCAL
// registerErrorKey uændret (409 skelnes på detail, P6)
```

**Bølge 2 leverer:**

```ts
// auth – SessionService
login(identifier: string, password: string): Observable<void>; // completer ved 200 OG ved 403 (→ pending-verification)
checkVerification(): Observable<boolean>;  // login med adgangskoden i hukommelsen; false uden
resendVerification(): Observable<void>;    // { emailOrUsername }
renewOnOpen(): void;                        // én refresh ved app-start
// verifyEmail() og fillProfileFrom() slettes. USERNAME_PATTERN = /^[^@]+$/ i core/constants/auth.ts.

// food – FoodLogService (SessionDataStore)
readonly status: Signal<StoreStatus>;
readonly foods: Signal<readonly FoodDto[]>;   // brugerens katalog
// beholdes: today, entries, byMeal (fra mealType), totals, allEntries, customFoods, entriesFor, totalsFor, dailyTotals, hasCustomFoodNamed
add(food: FoodItem, meal: MealId): Observable<LoggedFood>;          // ensureFood → POST me/food-logs (consumedAt = nu, mealType)
update(logId: string, patch: …): Observable<LoggedFood>;            // PATCH { quantity, unit }
remove(logId: string): Observable<void>;
addCustomFood(input: CustomFoodInput): Observable<FoodItem>;       // 409 → DuplicateCustomFoodNameError
ensureFood(item: FoodItem): Observable<FoodDto>;                    // katalog-id | scannet | ny egen vare → server-madvare (+ serving)
addLogs(dtos: readonly FoodLogDto[]): void;                         // samlinger logger via API'et og lægger rækkerne ind
// updateCustomFood/PATCH foods slettes (P12). FOOD_LOG_RETENTION_DAYS = 90.
// core/models/food-api.ts: ApiQuantityUnit, ApiMealType, FoodDto, FoodServingDto, FoodLogDto, Create/UpdateFoodLogRequest
// core/constants/meals.ts: MEAL_TYPE_BY_MEAL: Record<MealId, ApiMealType>, MEAL_BY_MEAL_TYPE
// core/constants/food.ts: FOOD_LOG_MAX_KCAL = 9999, FOOD_LOG_MAX_MACRO_GRAMS = 999 (loft pr. logning)
// core/services/food-log/food-log-mapping.ts: toFoodItem(dto), toLoggedFood(dto), toPer100(input)
// shared/components/ui-confirm-sheet: inputs open, titleKey, accentKey, bodyKey, bodyParams?, confirmKey, cancelKey, busy; outputs confirmed, closed

// weight – WeightLogService (SessionDataStore)
readonly status: Signal<StoreStatus>;
// beholdes: entries, latest, weighedToday, entriesWithin, seriesFor, rangeLabel
add(kg: number): Observable<WeightSaveResult>; // { kind: 'saved'; entry } | { kind: 'exists'; id }
update(id: string, kg: number, at?: Date): Observable<WeighEntry>;
remove(id: string): Observable<void>;
// load() = kun GET ?limit=100. Efter hver mutation: profile.update({ weightKg }) (nyeste vejning, ellers GET latest) + reloadGoal()
// core/models/weight.ts: WeightLogDto, WeightSaveResult; WeightRange '1u' | '3u' | '3m'
```

**Bølge 3 leverer:** `CollectionsService` (`status`, `collections`, `collectionById`,
`collectionTotals`, `isNameTaken`, `create`, `update`, `remove`, `log(id, meal)` – alle mutationer
`Observable`), `SessionService.withdrawConsent()` (Terms), `UserProfileService.uploadPhoto(blob)` /
`deletePhoto()`. Home og history er rene forbrugere.

### 4.4 Merge

**Før bølge 1** committer orkestratoren `kravspec.md` og `plan-v2.md` på `feat/api-integration`
(worktrees ser kun committede filer). Orkestratoren merger efter hver bølge i rækkefølgen i §4.1 til
`feat/api-integration` og kører `npx ng test --watch=false && npx ng build` i hovedtræet. Konflikter i
i18n-JSON og README'er løses ved at beholde begge sider. `wave1/api` kan merges når som helst (den rører
kun `API/`, `API.Tests/`, `.gitignore` og `mobilapp/docs/api-integration/`). Før UI-testen: `docker compose -f
mobilapp/docs/api-integration/docker/compose.yml up -d --build` fra hovedtræet (genskaber API-containeren
med outbox-mappen `docs/api-integration/docker/outbox` og kører migrationen).

## 5. Teststrategi

### 5.1 App (vitest)

Hvert domæne leverer specs for sin risiko, mindst: `readProblemBody` + streng-body; `clearAll` med
præfiks; login med e-mail/brugernavn, 403 → pending, 429-tekst; polling (fake timers: hvert 5. s kun
mens modalen er åben, ved `visibilitychange`, stopper ved `authenticated`); `renewOnOpen`;
glemt-siden sender præcis én request pr. tryk; profile save-routing pr. felt, 409 mål = succes,
`reloadGoal` efter PATCH, recalculate ved load med fallback; food-mapping (per100 for g/ml/stk/portion,
enheder og måltider begge veje), `ensureFood`-rækkefølge (POST foods → PUT serving → POST log), 409-retry,
logningsloftet i food-picker; vægt 409 → `exists` uden PATCH, confirm → PATCH, cancel → intet;
samlingsdiff PATCH → POST → DELETE → GET; historik cursor/filtre/mapping og skjult registreringsmål;
hjem rullende vindue, 30-dagesrækker, ingen fejring ved indlæsning, profilfejl → `loadFailed`;
billedark: `readImage` afviser → `readError`; eksport-URL med `?token=`; withdraw rydder først efter 204.

### 5.2 API (xUnit i Docker)

Test (fra repo-roden; kopierer kilden, så `bin/obj` aldrig skrives i `API/`):

```bash
docker run --rm -v "$PWD/API":/repo/API:ro -v "$PWD/API.Tests":/repo/API.Tests:ro \
  -v fitnessapp-nuget:/root/.nuget/packages mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c 'mkdir /work && cp -r /repo/API /repo/API.Tests /work/ && rm -rf /work/*/bin /work/*/obj && cd /work && dotnet test API.Tests/API.Tests.csproj'
```

Migration (skriver kun `Migrations/*.cs` tilbage):

```bash
docker run --rm -v "$PWD/API":/src -v fitnessapp-nuget:/root/.nuget/packages mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c 'mkdir /work && cp -r /src/. /work && cd /work && rm -rf bin obj && dotnet tool install -g dotnet-ef --version "10.*" && export PATH="$PATH:/root/.dotnet/tools" && dotnet restore API.csproj && dotnet ef migrations add AddMealTypeAndPendingEmail --project API.csproj && dotnet ef migrations has-pending-model-changes --project API.csproj && cp Migrations/*.cs /src/Migrations/'
```

xUnit bruger Sqlite `EnsureCreated`, så migrationen kontrolleres kun af `has-pending-model-changes`
og compose-`migrate` mod Postgres. Nye/ændrede tests: login-matrix (e-mail/brugernavn × rigtig/forkert ×
verificeret/ikke; ukendt og forkert giver samme 401; 5 fejl → 6. forsøg 429 også med rigtig adgangskode;
succes nulstiller; nulstillet adgangskode fjerner lockouten), brugernavn med `@` → valideringsfejl
(`Validator.TryValidateObject` på `RegisterRequest` – init-properties; `UpdateAccountRequest` er en
positionel record, hvor attributterne sidder på parameteren, og dækkes af live-tjekket), verify-link
(gyldigt → aktiv; brugt/udløbet → fejl), reset-GET forbruger ikke tokenet, reset-POST forbruger og
revokerer, e-mailskift (konto aktiv efter PATCH, adressen skiftes kun ved verify, optaget ved verify →
fejl), refresh samme dag (samme token) og anden dag (roterer; brug en lille `TimeProvider`-subklasse,
ingen NuGet), `mealType` påkrævet og stemplet af collection-log, historik-payload pr. type,
eksport-token round-trip + "garbage" → 404.

### 5.3 Live-kontrakttjek (API-agenten)

Efter `docker compose … up -d --build` fra API-worktreet: curl-scenarier for hvert punkt i §3 med
engangsbrugere (`<navn>+<random>@example.test`, slettes med `DELETE /api/v1/me` bagefter), links
læses fra outboxen. `curl -s -D - -o /dev/null` (GET; HEAD giver 405) på de fire HTML-sider viser
`Content-Type: text/html; charset=utf-8`;
`PATCH me {"username":"a@b"}` → 400 `errors.Username`. Swagger regenereres til
`docs/api-integration/docker/swagger.json`.

### 5.4 UI-testplan (browser, efter alle merges)

Værktøj: Claude Browser-panelet (`preview_start` konfigurationen `mobilapp-dev` fra
`mobilapp/.claude/launch.json`, `resize_window` preset `mobile`), ét app-faneblad (refresh-tokens deles i
`localStorage`); mail-links åbnes i et **andet** faneblad (ikke app-fanen – ventetilstanden er kun i
hukommelsen). Link fra outboxen:
`f=$(grep -l "To: $EMAIL" $(ls -t mobilapp/docs/api-integration/docker/outbox/*.txt) | head -1); grep -o 'http[^[:space:]]*' "$f"`
(fallback: `docker exec fitnessapp-dev-api-1 sh -c 'ls -t /app/.dev-outbox/*.txt'`). Efter hvert
trin: `read_console_messages` (onlyErrors) og `read_network_requests` (ingen `Authorization` til Open
Food Facts, forventede verber/URL'er). Engangsbrugere med tilfældig adgangskode; skriv ikke
adgangskoder i rapporten.

**Forventede fejl (ikke defekter):** `POST auth/login` 403 hvert 5. s, mens verifikationsmodalen er
åben; 4xx i de negative trin (401 forkert login, 409 optaget, 429 lockout, 400 ugyldige værdier, 404
brugt eksport-token); `DELETE me/profile/image` 404; 401 på `/me/**` lige før en refresh i trin 6;
500/502/504 fra dev-proxyen og netværksfejl i konsollen, mens API-containeren er stoppet (trin 11 og
13). Alt andet 4xx/5xx og enhver anden konsolfejl er en defekt.

1. **Setup:** compose op fra hovedtræet, `curl localhost:5210/health`, app i mobil-viewport.
2. **1.0:** brugernavn med `@`, for kort adgangskode (kravene vises), gentag ≠, alder under 13,
   "holde vægt" springer målvægt/tempo over, målvægt på forkert side, ugyldig e-mail, vilkår ikke
   accepteret → ingen konto. Opret konto A → modalen "tryk på linket".
3. **1.1:** "Send mail igen" → det gamle link giver ugyldig-siden (3a), det nye giver bekræftet-siden
   (æ/ø/å vises korrekt) → app-fanen lukker modalen selv inden for ~5 s → Hjem. 4a: ugyldigt token →
   ugyldig-siden. 6a: konto B → genindlæs appen (gæst, e-mail udfyldt) → log ind → modal → link → Hjem.
   1.0-1a/15b: ny signup med A's brugernavn → "optaget"; med A's e-mail → "i brug".
4. **1.3:** Profil → Log ud → Annuller (bliver) → Log ud → bekræft → login (`POST auth/logout` 204).
5. **1.2:** log ind med brugernavn og med e-mail; forkert adgangskode → neutral tekst; 5 forkerte → 6.
   forsøg (også rigtigt) → "for mange forsøg"; `docker restart fitnessapp-dev-api-1` nulstiller.
6. **1.5/1.5b:** genindlæs mens logget ind → præcis én `POST auth/refresh`, svaret har samme
   refresh-token (samme UTC-dag). `SessionService` læser `localStorage` kun ved opstart, så hver
   manipulation efterfølges af en **genindlæsning**: `accessTokenExpiresAt` i fortiden → genindlæs →
   præcis én refresh, og alle `/me/**`-kald bagefter har det nye bearer og giver 200 (1.5b). Et
   ugyldigt `accessToken` med fremtidig udløbstid → genindlæs → `/me/**` får tom 401, gentages og giver
   200 efter højst én refresh. Ugyldigt refresh-token + udløbet access → genindlæs → login.
7. **1.4:** glemt med e-mail, med brugernavn og med ukendt → samme besked (ukendt: ingen ny mail) →
   link → formular: ikke ens / for kort → fejl; gyldig → succes-siden → login med ny adgangskode
   virker, den gamle ikke; brugt link → ugyldig-siden; "Send igen" gør det forrige link ugyldigt.
8. **2.x:** højde, fødselsdato (under 13 afvises), køn, skridt, træning, mål tabe/holde/tage + tempo,
   målvægt → kaloriemålet på Profil/Hjem ændres; luk uden at gemme = uændret; værdier holder efter
   genindlæsning; lav værdier (kvinde, lav, tabe 1 kg/uge) → "sikkert minimum". **2.0:** skift e-mail →
   bekræftelse, stadig logget ind → link fra mailen til den nye adresse → genindlæs → ny e-mail; login
   med den nye virker; B's e-mail → "optaget". **2.4:** vælg billede (injicér en canvas-PNG i
   `input[type=file]` via `DataTransfer` + `change` i `javascript_tool`) → beskær → "Brug billedet" →
   avatar fra `/api/v1/dev-images/…`, holder efter genindlæsning; en tekstfil med navnet `x.jpg` →
   "Billedet kan ikke bruges …" og **ingen** `PUT`; luk uden at bekræfte = uændret; "Fjern foto".
9. **3.x:** manuel madvare (navn, mængde, kcal, P/K/F) → logget i valgt måltid; samme navn → 3a;
   negative/for store værdier, en mængde over loftet og tomt påkrævet felt blokeres. Søg eksisterende →
   mængde → "Frokost" → genindlæs → stadig under Frokost. Ret mængde (kun mængde kan rettes) → totaler.
   Fjern → bekræft-ark (annullér/bekræft). Stregkode via manuel indtastning af en kendt EAN (vist ≤ 2 s)
   → justér mængde → log; ukendt EAN → "ikke fundet" → manuel formular.
10. **4.x:** samling uden varer kan ikke gemmes; med 2 varer → samlet næring; redigér (tilføj/fjern,
    omdøb) → holder efter genindlæsning; sidste vare kan ikke fjernes; log samlingen som "Aften" → N
    rækker under Aften; slet med bekræftelse.
11. **5.x:** i dag viser summen (0 uden poster); mål ved siden af; 7 rullende ringe med i dag sidst; tryk
    på en dag → kort med makroer; "Se de seneste 30 dage" → 30 rækker, nyeste øverst, kcal/mål + P/K/F;
    et allerede nået dagsmål fejres **ikke** ved genindlæsning. Fejl: `docker stop fitnessapp-dev-api-1`
    → genindlæs → besked + "Prøv igen"; start igen → retry virker.
12. **6.x:** registrér vægt → seneste + mål ændres; igen samme dag → spørgsmål → Annuller (uændret) → Ja
    (overskrevet); ny konto → startvægten med etiket, tom liste forklarer startvægten; ret seneste; graf
    1u/3u/3m inkl. tom graf.
13. **7.0:** ny konto → **kun** "Konto oprettet"; opret 60+ madlog med curl (Bearer fra
    `nutrify.session` via `javascript_tool`) → grupperet pr. dag, nyeste øverst; scroll til bunden →
    næste side (`GET me/history` med `cursor`); filtre; fejl med API stoppet → besked + retry.
14. **8.0:** slå en påmindelse til, sæt tid → genindlæs → holder; hovedkontakt → `PUT
me/settings/Notifications`; browseren viser "understøttes ikke"-noten.
15. **9.1:** "Download mine data" → `POST me/data-export/token` 200 og `GET data-export?token=…` 200 med
    `Content-Disposition: attachment`.
16. **Sprog:** skift til engelsk → forkert login og glemt-besked på engelsk.
17. **9.2** (engangskonto): Privatliv → vilkårsrækken → "Træk tilbage" → bekræft → login; login igen → 401.
18. **9.0** (hovedkonto): slet konto → login; login igen → fejler.

Fejl rapporteres med trin, forventet/faktisk og netværks-/konsoluddrag. UI-testeren retter ikke kode.

## 6. Bølge-0-fund

Alle 24 review-fund fra bølge 0 er **rettet** i `f1e2d55`. `auth` har siden slettet koden bag de fire,
som de nye flows gjorde forældede (login efter reset på glemt-siden, `checkVerification` efter
genstart med `VERIFICATION_UNCHECKABLE`, `verified`-flaget i `session.ts`), og `fillProfileFrom`.
Fundlisten (`wave0-open-review-findings.md`) er slettet; den ligger i git-historikken.

## 7. Risici og åbne spørgsmål

Risici (kort): tokens i URL'er (verify 24 t, reset 1 t, eksport 5 min) – logges kun ikke, fordi
`Microsoft.AspNetCore` står på Warning; hold den der. `PublicBaseUrl` localhost virker kun i
desktop-browseren (emulator/telefon kræver `App__PublicBaseUrl` med LAN-IP). Lockout er pr. instans,
et burst præcis ved oprettelsen af tælleren kan snige få ekstra forsøg ind (`GetOrCreate` er ikke
atomar), og den kan bruges til at låse et kendt brugernavn i op til 15 min (en nulstillet adgangskode
løfter den). 409-skelnen i appen afhænger af API'ets `detail`-tekst (P6) – ændres teksten, viser appen
"e-mail i brug" for begge. Mail-scannere kan trykke verify-links (ved
e-mailskift er brugeren stadig logget ind og kan rette). Ukendte identifikatorer springer hashing over
(timing, eksisterende). Første billede efter kold start viste defaults, til profilen var hentet
(løst: loading-tilstande, ingen gættede tal før storene er hentet). Samlingsredigering er ikke atomar (genindlæs + fejl, intet datatab). Ingen
idempotens: CTA'er deaktiveres under kald. Dev-billeder forsvinder, når containeren genskabes. Committede
hemmeligheder (`Jwt:SigningKey`, Azure-SAS i `appsettings.json` og i `profileImageUrl`) skal roteres af
ops før enhver rigtig udrulning (se `README.md` "Før produktion").

Åbne spørgsmål til Janick (stadig åbne; appen er bygget med standardvalgene i §2, se `README.md`):

1. Aldersgrænse 13 (API) eller 16 (oprindeligt design)?
2. OK at kaloriemålet skifter til API'ets formel (240–370 kcal fra appens gamle) og at manuelt mål +
   adaptiv justering slettes?
3. OK at samlingsikon/-måltid, opskrifter/systemsamlinger, scannerens "ukendt vare", enheder og
   makroredigering af egne madvarer under redigering af en logning slettes?
4. Graf 3 uger, rullende 7 dage og "hele måneden" som de seneste 30 dage (spec'en tolket) frem for
   designets 4 uger, kalenderuge og kalendermåned?
5. ~~OK at hver vejning/profilændring giver en "Mål opdateret"-række i historikken?~~ Delvist løst
   (`4f1e827`): kun når tallene ændres. Tilbage: OK at en ændring, der flytter kaloriemålet, giver en
   række?
6. Hvem roterer hemmelighederne og fjerner SAS fra `profileImageUrl` før produktion?
7. "Frokost" eller spec'ens "middagsmad" som label?
8. OK at samtykkeoversigten er én række for vilkårene (inkl. sundheds- og profildata)? (**Ja**,
   P20.) Skridt fra Apple Sundhed / Health Connect (2.6, 9.2-3a) er bygget som en egen række med
   kontakt (`tasks/health.md`).
