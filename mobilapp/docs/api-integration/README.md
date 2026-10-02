# API-integration – overdragelse

Mobilappen er koblet på FitnessApp-API'et (`../API`, .NET 10), så app og API tilsammen opfylder
`kravspec.md`. **API'et måtte ændres – minimalt**, og kun hvor kravspec ellers ikke kunne opfyldes,
eller hvor et flow ellers ville give datatab eller et sikkerhedshul. De tilladte ændringer står i
`plan-v2.md` §3 (bindende); nye API-ændringer kræver en ny beslutning (skriv dem i `api-gaps.md`).

Branch: `feat/api-integration` (lokal, ikke pushet). Alle domæne-branches (`wave<N>/<domæne>`) og
rettelserne fra UI-testen (`uifix<N>/<domæne>`) er merget.

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

Påmindelser og præstationer er stadig lokale på enheden (P18, P21). Opgaveteksterne står i `tasks/`.

### API-ændringer

Fra plan-v2 §3 (én migration, `AddMealTypeAndPendingEmail`, og `App:PublicBaseUrl`):

- **A1** login med e-mail eller brugernavn, 403 ved ubekræftet e-mail, lockout (5 forsøg / 15 min), brugernavne uden `@`.
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

### Tests (målt 2026-10-01 på `d6d1231`)

- App: `cd mobilapp && npx ng test --watch=false` → **973 tests i 100 filer, alle grønne**.
- API: xUnit i Docker (kommandoen nedenfor) → **32 tests, alle grønne**.

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
   (`tasks/health.md`).

## Før produktion

- **Hemmeligheder:** `Jwt:SigningKey` og Azure-SAS'en ligger committet i `API/appsettings.json`.
  Rotér begge, flyt dem til miljøvariabler/user-secrets, og stop med at sende container-SAS'en i
  `profileImageUrl` (SAS pr. blob med kun læseret, eller billedet via API'et).
- **`App__PublicBaseUrl`** skal sættes til API'ets offentlige HTTPS-URL. Links i mails bygges herfra,
  og API'et starter ikke uden en absolut http(s)-URL uden for Development.
- **SMTP** (`Smtp:*`) skal være sat op: uden for Development sendes mails via SMTP, og en fejl giver i
  dag 500, efter at kontoen er oprettet (`api-gaps.md`).
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
| `tasks/*.md`          | Opgaveteksterne pr. domæne og til UI-testen, som de blev sendt (historik; nævner filer, der er slettet).  |
| `map/api-contract.md` | Tværgående API-kontrakt fra før ændringerne: JSON, fejlformer, auth, paginering (baggrund; §3 går forud). |
| `map/<domæne>.md`     | Mapping app ↔ API pr. domæne fra før integrationen (baggrund om koden, ikke om beslutningerne).           |
| `map/critic.md`       | Rettelser til mapping-rapporterne. Går forud for dem, men ikke for `plan-v2.md`.                          |
| `docker/compose.yml`  | Postgres + migration + API i Development.                                                                 |
| `docker/swagger.json` | Swagger fra API'et efter bølge 1 (de senere API-rettelser ændrede ikke kontrakten).                       |
| `docker/outbox/`      | Dev-mails som tekstfiler (ignoreret af git).                                                              |

Sletter du mappen, så flyt `docker/compose.yml` og `api-gaps.md` et sted hen, hvor de bliver ved med
at være nyttige.
