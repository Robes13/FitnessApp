# API-integration – overdragelse

Mobilappen er koblet på FitnessApp-API'et (`../API`, .NET 10), så app og API tilsammen opfylder
`kravspec.md`. **API'et måtte ændres – minimalt**, og kun hvor kravspec ellers ikke kunne opfyldes,
eller hvor et flow ellers ville give datatab eller et sikkerhedshul. De tilladte ændringer står i
`plan-v2.md` §3 (bindende); nye API-ændringer kræver en ny beslutning (skriv dem i `api-gaps.md`).

Branch: `feat/api-integration` – merget ind i `main` 2026-10-02 (lokalt, ikke pushet). Alle
domæne-branches (`wave<N>/<domæne>`) og rettelserne fra UI-testen (`uifix<N>/<domæne>`) er merget.

## Status

**Færdig.** Alle bølger i plan-v2 §4.1 er merget, og appen bruger API'et i alle domæner:

| Domæne (bølge)       | Hvad appen gør mod API'et                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP-kerne + session | Bearer kun til API'et, single-flight refresh med ét retry, `SessionService` og `SessionDataService` (stores indlæses ved login).          |
| `profile` (1)        | Profil, mål og indstillinger fra `/me`, `/me/profile`, `/me/goals`, `/me/settings`. Kaloriemålet er API'ets; genberegning ved indlæsning. |
| `auth` (2)           | Login med e-mail eller brugernavn, 403 → verifikationsmodal med login-polling, lockout-besked, glemt adgangskode via API'ets side.        |
| `food` (2)           | Madlog med måltidstype, egne madvarer (portion → per 100), stregkode: eget katalog først, så Open Food Facts. Loft pr. logning.           |
| `weight` (2)         | Vejninger; 409 → spørgsmål om overskrivning → `PATCH`. Graf 1 uge / 3 uger / 3 måneder.                                                   |
| `collections` (3)    | Madsamlinger med redigering som diff og logning under en måltidstype.                                                                     |
| `home` (3)           | I dag, rullende 7 dage og et ark med de seneste 30 dage; fejring først, når data er indlæst.                                              |
| `history` (3)        | `GET /me/history` med payload og løbende indlæsning.                                                                                      |
| `profile-extras` (3) | Profilbillede (upload/slet), dataeksport som download, tilbagetrækning af samtykke (= slet konto).                                        |

Påmindelser og præstationer er stadig lokale på enheden (P18, P21).

### API-ændringer

Fra plan-v2 §3 (én migration, `AddMealTypeAndPendingEmail`, og `App:PublicBaseUrl`):

- **A1** login med e-mail eller brugernavn, 403 ved ubekræftet e-mail, lockout (5 forsøg / 15 min), brugernavne uden `@` (siden mergen: `UsernameRules`, uden forskel på store og små bogstaver).
- **A2** verifikationsmail med link og en API-side (`GET auth/email/verify`); resend med identifikator.
- **A3** glemt adgangskode med e-mail eller brugernavn og en API-hostet nulstillingsside.
- **A4** refresh samme UTC-dag giver det samme refresh-token.
- **A5** e-mailskift uden deaktivering; adressen skiftes, når linket trykkes.
- **A6** `mealType` på madlog og logning af samlinger.
- **A7** historik med payload (`foodLog`, `weightLog`, `goal`).
- **A8** dataeksport som download via et kortlivet token i query-strengen.
- **A10** profilbilleder gemmes lokalt i Development.
- **A11** de syv tomme controller-klasser er slettet, `Migrations/README.md` rettet. (A9 udgik.)

Senere rettelser:

- `c2ad5e4`: per-100-værdier, serving-gram og madlog-mængder/-totaler, der ville løbe over
  `numeric(7,2)`/`numeric(9,2)`, afvises med 400 i stedet for 500 (én guard i
  `FoodNutritionCalculator` + `RequestGuards.EnsureAtMost`).
- `4f1e827`: `force`-parameteren på `UserGoalService.RecalculateAsync` er slettet. En vejning eller
  profilændring opretter kun en ny `UserGoal` (og "Mål opdateret" i historikken), når tallene ændres.

### Merge med main (2026-10-02)

`main` havde Roberts `8563897` (brugernavn-login, e-mailverifikation via Resend) og `8b96be5`
(Firebase-konfiguration). Kontrakten i plan-v2 §3 gælder uændret; Roberts forbedringer er koblet på:

- **Brugernavne:** `UsernameRules` – 3–50 af a–z, A–Z, 0–9, `-` og `_` (erstatter `^[^@]+$`; stadig
  intet `@`) ved register og `PATCH me`, 400 `errors.Username`. Login, resend og glemt adgangskode
  slår brugernavnet op uden forskel på store og små bogstaver (`USER.NormalizedUsername`, genereret
  af databasen, unikt indeks; et samtidigt dublet-brugernavn giver 409). E-mails som før (små
  bogstaver). Gamle brugernavne, der ikke opfylder reglen, kan stadig logge ind. Appen:
  `USERNAME_PATTERN` = samme regel (tjekkes utrimmet), én hint-tekst, login-feltet højst 320 tegn.
- **Mails:** uden for Development sendes de via Roberts `IEmailService`/`SmtpEmailService` (Resend,
  `nutrify@eldorado-fts.dk`, nøglen i `appsettings.Local.json`) med vores tekster og links fra
  `AccountEmails` (tekst + samme tekst som HTML med klikbart link). Development skriver stadig til
  outboxen. En fejlet afsendelse logges og giver ikke længere 500 (kontoen findes, mailen kan bedes om
  igen). Links bygges fra `App:PublicBaseUrl` (`appsettings.json`: tom, så produktion skal sætte
  `App__PublicBaseUrl` – Roberts `https://eldorado-fts.dk` er kandidaten, når API'et kører der;
  Development: `http://localhost:5210`).
- **Verifikation:** `EMAIL_VERIFICATION_TOKEN.Email` (Robert) binder et token til kontoens adresse
  ved udstedelsen – ændres adressen, virker linket ikke; `NewEmail` (vores) er den ventende nye adresse
  ved e-mailskift. Tokenet tages atomisk i én transaktion, og en allerede bekræftet konto kan kun
  bekræftes igen af et e-mailskift-token. Resend: højst én mail pr. konto pr. minut (stadig 204).
- **Droppet fra Robert:** login kun med brugernavn (`LoginRequest.Username`), hans `GET email/verify`
  (redirect) og `GET email/verified` (vores HTML-side bruges), den engelske `VerificationEmailTemplate`,
  `Smtp:ApplicationUrl` (= `App:PublicBaseUrl`) og `UserDto.emailVerified` (ingen brugte det;
  `emailVerifiedAt` findes). Hans tests er tilpasset den forenede kontrakt; `API/EMAIL_SETUP.md` og
  `API/USERNAME_LOGIN.md` beskriver den.
- **Migrationer:** hans `20260930082029_BindEmailVerificationTokensToEmail` og
  `20260930084037_AddNormalizedUsername` er uændrede og kører før vores `AddMealTypeAndPendingEmail`
  (EF anvender manglende migrationer, også ældre end den nyeste). Den første ugyldiggør alle
  ubrugte verifikationslinks; den anden afbryder, hvis to brugernavne kun adskiller sig i store/små
  bogstaver.

### Tests (målt 2026-10-02 efter mergen)

- App: `cd mobilapp && npx ng test --watch=false` → **1051 tests i 105 filer, alle grønne** (to kørsler);
  `npx ng build` uden advarsler; Android `assembleDebug` og iOS-simulator-build lykkes.
- API: xUnit i Docker (kommandoen nedenfor) → **59 tests, alle grønne**; `has-pending-model-changes`
  → ingen ændringer.

### UI-test

Alle use cases i plan-v2 §5.4 er testet i browseren (mobil-viewport 375×812) mod API'et i Docker fra
hovedtræet. Første runde fandt 18 defekter (2 større: et signup-udkast overlevede log ud, og
scanneren loggede under et skjult måltid); kun ét use case-trin fejlede (stregkode fra Mad-siden uden
valg af måltid). Der blev rettet i 3 runder (18 + 3 + 3 defekter), og gentesten efter runde 3 fandt
**0 åbne defekter**. Stregkodeopslaget tog 163 ms (krav ≤ 2 s). Kun native kan teste: kamera- og
notifikationstilladelser (2.4-3a, 8.0-4a) og eksport via systembrowseren (9.1). Efter UI-testen er
desuden rettet: svar, der lander efter log ud, droppes (`f1d996a`, `SessionService.accountId`),
død adgangskodestyrke-kode er slettet (`c585a29`), og "Standard" i madvælgeren viser varens egen
portion (`d6d1231`). Spec-noterne fra testen står i `api-gaps.md`.

## Åbne beslutninger til Janick

Fra plan-v2 §7. Appen er bygget med standardvalget i parentes.

1. Aldersgrænse 13 eller 16? (**13**, API'ets regel. 16 = én linje i
   `API/Utilities/ProfileValidation.cs` + `MIN_AGE` i `core/constants/nutrition.ts`.)
2. Kaloriemålet fra API'ets formel (240–370 kcal fra appens gamle)? (**Ja**; manuelt mål og adaptiv
   justering er slettet.)
3. OK at samlingsikon/-måltid, opskrifter/systemsamlinger, scannerens "ukendt vare", enheder og
   makroredigering af egne madvarer under redigering af en logning er slettet, og at en samling logges
   uden multiplikator (kun ret række for række bagefter)? (**Ja**, P12/P13.)
4. Graf 3 uger, rullende 7 dage og "hele måneden" som de seneste 30 dage? (**Ja**, P15/P16.)
5. OK at en vejning eller profilændring, der flytter kaloriemålet, giver en "Mål opdateret"-række i
   historikken? (**Ja**; uændrede tal giver ingen række siden `4f1e827`.)
6. Hvem roterer hemmelighederne og fjerner SAS fra `profileImageUrl`? (Se "Før produktion".)
7. "Frokost" eller spec'ens "middagsmad"? (**Frokost**.)
8. Samtykkeoversigten som én række (vilkår inkl. sundheds- og profildata)? (**Ja**, P20.) Skridt
   fra Apple Sundhed / Health Connect (2.6, 9.2-3a) er siden bygget som en egen række med kontakt
   (se `../../README.md`).

## Før produktion

- **Hemmeligheder:** `Jwt:SigningKey` og Azure-SAS'en ligger committet i `API/appsettings.json`.
  En Firebase-servicekontos **private nøgle** lå der også (fra `8b96be5` på `main`); den er fjernet fra
  filen (koden læser kun `Firebase:ProjectId`), men findes stadig i historikken og på `origin/main` og
  skal derfor **roteres**. Rotér alle tre, hold dem i miljøvariabler/`appsettings.Local.json`, og stop
  med at sende container-SAS'en i `profileImageUrl` (SAS pr. blob med kun læseret, eller billedet via
  API'et).
- **`App__PublicBaseUrl`** skal sættes til API'ets offentlige HTTPS-URL (Roberts
  `https://eldorado-fts.dk`, når API'et kører der). Links i mails bygges herfra, og API'et starter ikke
  uden en absolut http(s)-URL uden for Development (`appsettings.json` er tom).
- **SMTP:** uden for Development sendes mails via Resend (`API/EMAIL_SETUP.md`): `Smtp:Password` i
  `appsettings.Local.json`, og domænet skal være verificeret hos Resend. En fejl logges som en
  advarsel; brugeren får ingen mail, men kan bede om den igen.
- **Native API-URL:** `core/constants/api.ts` har kun dev-URL'er (Android-emulator `10.0.2.2`,
  iOS-simulator `localhost`). En fysisk telefon kræver Mac'ens LAN-IP (og `App__PublicBaseUrl` med
  samme adresse), produktion en HTTPS-URL. Klartekst-HTTP er kun tilladt i Android-debug-buildet
  (til `10.0.2.2`/`localhost`) og på iOS for lokale adresser (`NSAllowsLocalNetworking`). Relative
  dev-billed-URL'er gøres absolutte mod API'et og hentes gennem CapacitorHttp's proxy på appens
  egen origin, fordi Android-WebView'et ellers blokerer dem som mixed content (http i en https-side).
- **Test på en enhed:** kamera- og notifikationstilladelser, eksport via systembrowseren og
  `visibilitychange` i verifikationsmodalen.
- **Servicevilkår og privatlivspolitik** findes ikke som side; signup-teksten ligner links, men kan
  ikke åbnes. Samtykke til sundhedsdata kræver normalt, at vilkårene kan læses.
- **Skridt (2.6, 9.2-3a)** er bygget med `@capgo/capacitor-health` (se `mobilapp/README.md`). En
  rigtig iPhone kræver et team med HealthKit i provisioning-profilen, og Google Play kræver en
  godkendt erklæring for Health Connect-tilladelsen `READ_STEPS`. Push/Firebase bruges ikke;
  påmindelser er lokale notifikationer, og appen registrerer ingen enheder.
- Login-lockouten ligger i hukommelsen pr. API-instans og skal flyttes, hvis API'et skaleres ud.

## Sådan kører du API'et lokalt

`dotnet` er ikke installeret på maskinen, så API'et kører i Docker (fra `mobilapp/`):

```bash
docker compose -f docs/api-integration/docker/compose.yml up -d --build
```

- Compose bygger API'et fra `API/` i **det træ, kommandoen køres fra**, kører migrationerne og
  monterer træets `docs/api-integration/docker/outbox` som outbox. Kør den fra det træ, du vil teste.
- API: `http://localhost:5210` (Swagger: `/swagger`, health: `/health`), Postgres på host-port 5433.
- `migrate`-servicen kører EF-migrationerne én gang (uden at skrive `bin/obj` i `API/`).
- Start appen med `npm start` (dev-proxyen sender `/api` til `:5210`; API'et har ingen CORS).
  Log ind med e-mail **eller** brugernavn.
- Development: mails skrives som filer i `docs/api-integration/docker/outbox/*.txt` (ignoreret af
  git). Verifikations- og reset-mails har klikbare links til API'ets sider
  (`…/api/v1/auth/email/verify?token=…`, `…/api/v1/auth/password/reset?token=…`). Åbn dem i et
  andet faneblad end appen. Nyeste link for en adresse:
  `f=$(grep -l "To: $EMAIL" $(ls -t docs/api-integration/docker/outbox/*.txt) | head -1); grep -o 'http[^[:space:]]*' "$f"`.
- Linkene bygges ud fra `App:PublicBaseUrl` (Development: `http://localhost:5210`, som kun virker i
  desktop-browseren; emulator/telefon kræver API'ets LAN-adresse).
- Profilbilleder gemmes lokalt i Development (`/app/.dev-images` i containeren, serveret på
  `/api/v1/dev-images/<fil>`), så upload kan testes uden Azure. De forsvinder, når containeren
  genskabes.
- Login-lockouten (5 forsøg pr. 15 minutter) ligger i hukommelsen: `docker restart fitnessapp-dev-api-1`
  nulstiller den.
- Nulstil databasen: `docker compose -f docs/api-integration/docker/compose.yml down -v`.

API-tests og migrationer køres i SDK-containeren fra **repo-roden**. Kilden kopieres ind i
containeren, så `bin/obj` aldrig skrives i `API/`:

```bash
# Tests (xUnit)
docker run --rm -v "$PWD/API":/repo/API:ro -v "$PWD/API.Tests":/repo/API.Tests:ro \
  -v fitnessapp-nuget:/root/.nuget/packages mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c 'mkdir /work && cp -r /repo/API /repo/API.Tests /work/ && rm -rf /work/*/bin /work/*/obj && cd /work && dotnet test API.Tests/API.Tests.csproj'

# Ny migration (skriver kun Migrations/*.cs tilbage)
docker run --rm -v "$PWD/API":/src -v fitnessapp-nuget:/root/.nuget/packages mcr.microsoft.com/dotnet/sdk:10.0 \
  bash -c 'mkdir /work && cp -r /src/. /work && cd /work && rm -rf bin obj && dotnet tool install -g dotnet-ef --version "10.*" && export PATH="$PATH:/root/.dotnet/tools" && dotnet restore API.csproj && dotnet ef migrations add <Navn> --project API.csproj && dotnet ef migrations has-pending-model-changes --project API.csproj && cp Migrations/*.cs /src/Migrations/'
```

Se også `API/Migrations/README.md`. Appens kontrakter står i `core/services/README.md`,
`core/utils/README.md`, `core/interceptors/README.md` og `core/services/session-data/README.md`.

## Filer i denne mappe

| Fil                   | Indhold                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `plan-v2.md`          | **Bindende plan** (implementeret): rammer, produktbeslutninger, API-kontrakten (§3), bølger (§4), tests.  |
| `kravspec.md`         | Kravspecifikationen (use cases, ikke-funktionelle krav, acceptkriterier).                                 |
| `api-gaps.md`         | Mangelliste til API-teamet: hvad der er løst, hvad der stadig mangler, og noter fra UI-testen.            |
| `docker/compose.yml`  | Postgres + migration + API i Development.                                                                 |
| `docker/outbox/`      | Dev-mails som tekstfiler (ignoreret af git).                                                              |

Sletter du mappen, så flyt `docker/compose.yml` og `api-gaps.md` et sted hen, hvor de bliver ved med
at være nyttige.
