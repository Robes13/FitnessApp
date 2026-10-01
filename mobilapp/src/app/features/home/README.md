# Home

Appens forside (`/hjem`). Samler dagen i ét overblik: hilsen og avatar, ringene for de seneste
7 dage, arket med de seneste 30 dage, næste skridt, den valgte dags tal, målkortet og de seneste
7 dages nøgletal. Derudover ligger de to tilstande, der kun hører hjemme her: fejrings-toasten,
når dagsmålet rammes, og bekræftelses-arket, der låser skærmen, indtil e-mailen er bekræftet.

## Indhold

| Mappe         | Indhold                                                         |
| ------------- | --------------------------------------------------------------- |
| `pages/`      | `HomePage` – route-komponenten, der sætter skærmen sammen       |
| `components/` | Kortene, ringene, 30-dages-arket, toasten og bekræftelses-arket |
| `services/`   | `HomeSummaryService` – alle skærmens afledte tal ét sted        |

Route-filen er [`home.routes.ts`](home.routes.ts) og eksporterer `HOME_ROUTES`, som
`features/shell/shell.routes.ts` lazy loader.

## Data

Alt på skærmen er brugerens egne data fra API'et via stores i `core/`: madloggen
(`FoodLogService`, 90 dage indlæst), vejningerne (`WeightLogService`) og profilen med kalorie- og
makromålet (`UserProfileService.targets`). Hjem laver ingen kald selv; `SessionDataService` henter
storene, når sessionen er logget ind (use case 5.2–5.5, P15 i `plan-v2.md`).

- **Seneste 7 dage:** ringene, dagskortet og nøgletallene ruller fra i dag − 6 til i dag, med i dag
  yderst til højre. Ugen følger `FoodLogService.today` og flytter sig derfor ved midnat.
- **Seneste 30 dage:** "Se de seneste 30 dage" under ringene åbner `HomeMonthSheet` – rullende
  som ugen, nyeste øverst, dag · kcal/mål · P/K/F. Ingen månedsnavigation: med kalendermåneden ville
  arket d. 1.–6. vise færre dage end ugen.
- **Dage uden poster** er `null` hele vejen igennem: tom ring, `–` i dagskortet og arket og ingen
  andel i nøgletallene. Skærmen påstår aldrig, at en dag var uden mad. Kun **i dag** viser 0 kcal
  og 0 g makroer – men først når madloggen er hentet (`–`, mens den indlæses).
- **Før data er hentet** gætter skærmen ikke: kalorie- og makromålet er `–`, til API'ets mål er
  hentet, 7-dageskortet viser `–` uden opsamling, til madloggen og målet er hentet, og "Næste
  skridt" foreslår kun vejning og måltider ud fra hentede stores. Målkortet venter på målet.
- **Fejl:** fejler mad-, vægt- eller profil-storen, viser siden "Dine data kunne ikke hentes." med
  `app-ui-form-error` og "Prøv igen" over ringene. Knappen genindlæser kun de stores, der fejlede.
  Profilen tæller med, fordi en fejlet profil ellers ville vise et tavst kaloriemål på 0 (5.3).
- **Skridt (2.6-3b):** fejlede den månedlige skridtsynkronisering ved app-start
  (`StepSyncService.status` = `failed`), står "Vi kunne ikke hente dine skridt. Vi prøver igen næste
  gang." over ringene – også for en bruger, der ikke åbner Profil. Ingen "Prøv igen": næste
  app-start prøver selv igen.
- **Dagens tal** er summen af API'ets præcise værdier, afrundet én gang til visning (kcal og arket
  som hele tal, dagskortets makroer med højst én decimal) – samme tal som API'ets egne summer.
- **Fejringen** starter først, når både madloggen og profilen er hentet, og nås målet på en anden
  fane, fejres det, når man kommer tilbage til Hjem; se
  [`pages/home-page/README.md`](pages/home-page/README.md).

Tomme tilstande er indbygget i designet: er alt logget og vejet, forsvinder "Næste skridt"-kortet.
Bekræftelses-arket viser sine egne fejl med `app-ui-form-error`.

## Navigation

- Avataren → `/profil`.
- "Næste skridt" → `/vaegt` (vejning) eller `/mad?tilfoej=<måltid>`, så Mad åbner
  tilføj-arket med det rigtige måltid. Stier og query-parameternavne kommer fra
  `core/constants/app-route.ts` – aldrig som strenge.

## Målkortet

Det orange "Til mål"-kort er **skjult**, til API'ets mål er hentet (ellers ville det vise
tilmeldingens standardtal), og når profilens mål er `hold`: der er ingen afstand at tælle ned.
Fremdriften måles fra den ældste vejning til målvægten og bundes ved 4 %, som i designet, så
bjælken aldrig ser helt tom ud.
