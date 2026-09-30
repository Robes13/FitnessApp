# API-integration – overdragelse

Arbejdet med at koble mobilappen på FitnessApp-API'et (`../API`, .NET 10), så app og API tilsammen
opfylder `kravspec.md`. **API'et må ændres – minimalt**, og kun hvor kravspec ellers ikke kan
opfyldes, eller hvor et flow ellers ville give datatab eller et sikkerhedshul. Alle tilladte
API-ændringer står i `plan-v2.md` §3, som er bindende; andre ændringer kræver en ny beslutning (skriv
dem i `api-gaps.md`).

Branch: `feat/api-integration` (lokal, ikke pushet). Hvert domæne arbejder i sit eget worktree på
`wave<N>/<domæne>` (plan-v2 §0), og orkestratoren merger efter hver bølge (plan-v2 §4.4).

## Status

Bølgerne følger plan-v2 §4.1.

| Bølge   | Domæner                                               | Status                                                                                                                       |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0       | HTTP-kerne + auth/session                             | ✅ Merget. Alle 24 review-fund er rettet i `f1e2d55` (`wave0-open-review-findings.md`).                                      |
| 1       | `api` (API-ændringerne A0–A11 + docs)                 | ✅ Implementeret på `wave1/api`: API-tests grønne, ingen ventende modelændringer, alle punkter i §3 tjekket live mod Docker. |
| 1       | `profile` (inkl. den fælles app-forberedelse)         | ⏳ Parallelt med `api`.                                                                                                      |
| 2       | `auth` · `food` · `weight`                            | ⏳ Starter, når `profile` er merget.                                                                                         |
| 3       | `collections` · `home` · `history` · `profile-extras` | ⏳ Starter, når bølge 2 er merget.                                                                                           |
| UI-test | Browser-test af alle use cases (plan-v2 §5.4)         | ⏳ Efter bølge 3 og `api`, med Docker genstartet fra hovedtræet.                                                             |

Opgaveteksterne pr. domæne står i `tasks/*.md`.

### Bølge 0 – hvad der findes nu

- `proxy.conf.json` + `angular.json` `proxyConfig`: `npm start` sender `/api` til `http://localhost:5210` (API'et har ingen CORS).
- `core/constants/api.ts`: `API_BASE_URL` (`/api/v1` i browseren, absolut dev-URL på native) og `injectApiUrl()`.
- `capacitor.config.ts`: `CapacitorHttp` slået til (native HTTP uden CORS). Android-cleartext er **ikke** sat op.
- `core/models/api.ts` (`CursorPage<T>`), `core/utils/api.ts` (`fetchAllPages`, `toApiError`, `mapApiError`, `parseApiDateTime`).
- `core/interceptors/auth.interceptor.ts`: Bearer kun til API'et, proaktiv og reaktiv single-flight refresh, retry én gang.
- `SessionService`: `status` = `guest | pending-verification | authenticated`, tokens i `localStorage`.
  Signup → register → "indsæt koden fra mailen" → verify → auto-login. Login med **e-mail**.
  Glemt adgangskode med token fra mailen. Log ud og slet konto (`DELETE /me`) mod API'et.
  (Bølge 2 skifter til login med e-mail eller brugernavn og til links i mails, plan-v2 P1–P4.)
- `core/services/session-data/`: `SessionDataService` kalder `load()` på registrerede stores, når
  status bliver `authenticated`, og `reset()` ved `guest`. **Ingen stores er registreret endnu** –
  det gør bølge 1 og 2.

Kontrakten, som de næste domæner skal bygge på, står i `core/services/README.md`,
`core/utils/README.md`, `core/interceptors/README.md` og `core/services/session-data/README.md`.

## Sådan kører du API'et lokalt

`dotnet` er ikke installeret på maskinen, så API'et kører i Docker (fra `mobilapp/`):

```bash
docker compose -f docs/api-integration/docker/compose.yml up -d --build
```

- Compose bygger API'et fra `API/` i **det træ, kommandoen køres fra**, kører migrationerne og
  monterer træets `docs/api-integration/docker/outbox` som outbox. Kør den derfor igen fra det træ,
  du vil teste (efter merge: fra hovedtræet), så API og outbox passer sammen.
- API: `http://localhost:5210` (Swagger: `/swagger`), Postgres på host-port 5433.
- `migrate`-servicen kører EF-migrationerne én gang (uden at skrive `bin/obj` i `API/`).
- Development: mails skrives som filer i `docs/api-integration/docker/outbox/*.txt` (ignoreret af
  git). Verifikations- og reset-mails indeholder **links**
  (`…/api/v1/auth/email/verify?token=…`, `…/api/v1/auth/password/reset?token=…`), der åbnes i
  browseren. Nyeste link for en adresse:
  `f=$(grep -l "To: $EMAIL" $(ls -t docs/api-integration/docker/outbox/*.txt) | head -1); grep -o 'http[^[:space:]]*' "$f"`.
- Linkene bygges ud fra `App:PublicBaseUrl` (env `App__PublicBaseUrl`): API'ets absolutte URL, som
  brugerens browser når den. Development: `http://localhost:5210`, som kun virker i desktop-browseren
  (emulator/telefon kræver API'ets LAN-adresse). Uden for Development skal den sættes – API'et starter
  ikke uden en absolut http(s)-URL.
- Profilbilleder gemmes lokalt i Development (`/app/.dev-images` i containeren, serveret på
  `/api/v1/dev-images/<fil>`), så upload kan testes uden Azure. De forsvinder, når containeren
  genskabes. Produktion bruger Azure som før.
- Login-lockouten (5 forsøg pr. 15 minutter) ligger i hukommelsen: `docker restart fitnessapp-dev-api-1`
  nulstiller den.
- Nulstil databasen: `docker compose -f docs/api-integration/docker/compose.yml down -v`.
- Start appen med `npm start` (dev-proxyen peger på `:5210`).

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

Se også `API/Migrations/README.md`.

## Filer i denne mappe

| Fil                             | Indhold                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `plan-v2.md`                    | **Bindende plan**: rammer, produktbeslutninger, API-kontrakten (§3), bølger og filejerskab (§4), tests. |
| `kravspec.md`                   | Kravspecifikationen (use cases, ikke-funktionelle krav, acceptkriterier).                               |
| `tasks/*.md`                    | Opgaveteksten pr. domæne og til UI-testen.                                                              |
| `plan.md`                       | Erstattet – peger på `plan-v2.md`.                                                                      |
| `api-gaps.md`                   | Mangelliste til API-teamet med status efter bølge 1 og opfølgning.                                      |
| `map/api-contract.md`           | Tværgående API-kontrakt: JSON, fejlformer, auth, paginering, kørsel (baggrund; §3 går forud).           |
| `map/<domæne>.md`               | Mapping app ↔ API pr. domæne (baggrund om koden, ikke om beslutningerne).                               |
| `map/critic.md`                 | Rettelser til rapporterne. Går forud for dem, men ikke for `plan-v2.md`.                                |
| `wave0-open-review-findings.md` | Review-fundene fra bølge 0 (alle rettet).                                                               |
| `wave1-workflow.js`             | Historik – erstattet af `plan-v2.md` og `tasks/`.                                                       |
| `docker/compose.yml`            | Postgres + migration + API i Development.                                                               |
| `docker/swagger.json`           | Swagger-dokumentet fra API'et efter bølge 1 (`api`).                                                    |

Sletter du mappen, når integrationen er færdig, så flyt `docker/compose.yml` og `api-gaps.md`
et sted hen, hvor de bliver ved med at være nyttige.
