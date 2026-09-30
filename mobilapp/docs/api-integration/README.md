# API-integration – overdragelse

Arbejdet med at koble mobilappen på det eksisterende FitnessApp-API (`../API`, .NET 10).
Appen gemte før alt lokalt (`localStorage`) og havde et stubbet `AuthApi`. Målet er, at appen
bruger API'ets **nuværende** endpoints. Det, API'et mangler, samles som punkter til API-teamet.
**API'et må ikke ændres.**

Branch: `feat/api-integration` (lokal, ikke pushet).

## Status

| Del                                                                          | Status                                                                                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kortlægning af app ↔ API (alle domæner)                                      | ✅ Færdig – `map/`                                                                                                                                                          |
| Mangelliste til API-teamet                                                   | ✅ Første udgave – `api-gaps.md` (66 punkter). Nye fund fra de resterende domæner skal tilføjes.                                                                            |
| **Bølge 0:** HTTP-kerne + auth/session                                       | ✅ Implementeret, 802 tests grønne, build ren. Testet live mod Docker (script + browser). ⚠️ **24 review-fund er ikke rettet** – `wave0-open-review-findings.md` (2 major). |
| **Bølge 1:** profil/mål/indstillinger, profilbillede, påmindelser, vægt, mad | ⏳ Ikke startet. Opgaverne er beskrevet i detaljer i `wave1-workflow.js` (feltet `task` pr. domæne).                                                                        |
| **Bølge 2:** samlinger, hjem, historik, præstationer                         | ⏳ Ikke startet. Planen står i `map/collections.md` og `map/home-history-achievements.md`.                                                                                  |
| UI-test af alle flows i browseren                                            | ⏳ Kun auth er klikket igennem.                                                                                                                                             |

### Bølge 0 – hvad der findes nu

- `proxy.conf.json` + `angular.json` `proxyConfig`: `npm start` sender `/api` til `http://localhost:5210` (API'et har ingen CORS).
- `core/constants/api.ts`: `API_BASE_URL` (`/api/v1` i browseren, absolut dev-URL på native) og `injectApiUrl()`.
- `capacitor.config.ts`: `CapacitorHttp` slået til (native HTTP uden CORS). Android-cleartext er **ikke** sat op.
- `core/models/api.ts` (`CursorPage<T>`), `core/utils/api.ts` (`fetchAllPages`, `toApiError`, `mapApiError`, `parseApiDateTime`).
- `core/interceptors/auth.interceptor.ts`: Bearer kun til API'et, proaktiv og reaktiv single-flight refresh, retry én gang.
- `SessionService`: `status` = `guest | pending-verification | authenticated`, tokens i `localStorage`.
  Signup → register → "indsæt koden fra mailen" → verify → auto-login. Login med **e-mail**.
  Glemt adgangskode med token fra mailen. Log ud og slet konto (`DELETE /me`) mod API'et.
- `core/services/session-data/`: `SessionDataService` kalder `load()` på registrerede stores, når
  status bliver `authenticated`, og `reset()` ved `guest`. **Ingen stores er registreret endnu** –
  det gør bølge 1 og 2.

Kontrakten, som de næste domæner skal bygge på, står i `core/services/README.md`,
`core/utils/README.md`, `core/interceptors/README.md` og `core/services/session-data/README.md`.

## Sådan kører du API'et lokalt

`dotnet` er ikke installeret på maskinen, så API'et kører i Docker:

```bash
docker compose -f docs/api-integration/docker/compose.yml up -d --build
```

- API: `http://localhost:5210` (Swagger: `/swagger`), Postgres på host-port 5433.
- `migrate`-servicen kører EF-migrationerne én gang (uden at skrive `bin/obj` i `API/`).
- Development-miljø: mails skrives som filer i `docs/api-integration/docker/outbox/*.txt`
  (ignoreret af git). Verifikations- og reset-tokens er 64 hex-tegn i den nyeste fil for e-mailen.
- Nulstil databasen: `docker compose -f docs/api-integration/docker/compose.yml down -v`.
- Start appen med `npm start` (dev-proxyen peger på `:5210`).
- **Upload ikke profilbilleder mod dev-API'et**: `appsettings.json` peger på en rigtig Azure-container.

## Næste skridt (anbefalet rækkefølge)

1. Ret de reelle fund i `wave0-open-review-findings.md`. Begynd med de to major:
   refresh-nulstillingen i `session.ts` er utestet, og en ny konto på samme enhed arver den
   forrige kontos lokale profil.
2. Bølge 1: de fem domæner i `wave1-workflow.js`. De kan køres parallelt, hvis kontrakterne i
   `plan.md` ("Kontrakter mellem domæner") overholdes. Før start: tilføj stubben
   `UserProfileService.reloadGoal(): Observable<void>`, som profil implementerer og vægt kalder.
3. Bølge 2: samlinger, hjem, historik og præstationer. De bygger på mad (bl.a.
   `core/utils/meal-slot.ts`) og vægt.
4. UI-test af alle flows i browseren mod Docker-API'et, og saml nye API-mangler i `api-gaps.md`.

## Filer i denne mappe

| Fil                             | Indhold                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plan.md`                       | **Bindende beslutninger**: rammer, fælles kerne, parallelt arbejde, kontrakter og produktbeslutninger (kaloriemål, måltid i `consumedAt`, login med e-mail m.m.). |
| `api-gaps.md`                   | Mangelliste til API-teamet (dansk, klar til at sende).                                                                                                            |
| `map/api-contract.md`           | Tværgående API-kontrakt: JSON, fejlformer, auth, paginering, kørsel.                                                                                              |
| `map/<domæne>.md`               | Mapping app ↔ API og implementeringsplan pr. domæne.                                                                                                              |
| `map/critic.md`                 | Rettelser til rapporterne. **Går forud for dem**, hvor de er uenige.                                                                                              |
| `wave0-open-review-findings.md` | De ikke-rettede review-fund fra bølge 0.                                                                                                                          |
| `wave1-workflow.js`             | Opgavebeskrivelser for bølge 1 (skrevet som et Claude Code-workflow; `task`-teksterne kan også bruges manuelt).                                                   |
| `docker/compose.yml`            | Postgres + migration + API i Development.                                                                                                                         |
| `docker/swagger.json`           | Swagger-dokumentet fra API'et, som det er i dag.                                                                                                                  |

Sletter du mappen, når integrationen er færdig, så flyt `docker/compose.yml` og `api-gaps.md`
et sted hen, hvor de bliver ved med at være nyttige.
