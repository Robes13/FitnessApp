# Home

Appens forside (`/hjem`). Samler dagen i ét overblik: hilsen og avatar, ugens syv dagsringe,
næste skridt, den valgte dags tal, målkortet og ugens nøgletal. Derudover ligger de to
tilstande, der kun hører hjemme her: fejrings-toasten, når dagsmålet rammes, og
bekræftelses-arket, der låser skærmen, indtil e-mailen er bekræftet.

## Indhold

| Mappe         | Indhold                                                   |
| ------------- | --------------------------------------------------------- |
| `pages/`      | `HomePage` – route-komponenten, der sætter skærmen sammen |
| `components/` | Kortene, ringene, toasten og bekræftelses-arket           |
| `services/`   | `HomeSummaryService` – alle skærmens afledte tal ét sted  |

Route-filen er [`home.routes.ts`](home.routes.ts) og eksporterer `HOME_ROUTES`, som
`features/shell/shell.routes.ts` lazy loader.

## Data

Alt på skærmen er brugerens egne data: madloggen (`FoodLogService`), vejningerne
(`WeightLogService`) og profilen (`UserProfileService`).

Madloggen gemmer tidligere dage (`FoodLogService.dailyTotals`), så ugens ringe, dagskortet
og ugens nøgletal viser de rigtige kalorier og makroer for hver dag, brugeren har logget.
Dage uden en eneste post og dage, der ikke er kommet endnu, er `null` hele vejen igennem: tom
ring, `–` i dagskortet og ingen andel i ugens nøgletal. Skærmen påstår aldrig, at en dag var
uden mad.

Der er ingen netværkskald på skærmen, så der er heller ingen loading-tilstand. Tomme
tilstande er indbygget i designet: er alt logget og vejet, forsvinder "Næste skridt"-kortet,
og fremtidige dage viser `–` i stedet for tal. Bekræftelses-arket er det eneste sted med
asynkrone kald, og det viser fejl med `app-ui-form-error`.

## Navigation

- Avataren → `/profil`.
- "Næste skridt" → `/vaegt` (vejning) eller `/mad?tilfoej=<måltid>`, så Mad åbner
  tilføj-arket med det rigtige måltid. Stier og query-parameternavne kommer fra
  `core/constants/app-route.ts` – aldrig som strenge.

## Målkortet

Det orange "Til mål"-kort er **skjult**, når profilens mål er `hold`: der er ingen afstand at
tælle ned. Fremdriften måles fra den ældste vejning til målvægten og bundes ved 4 %, som i
designet, så bjælken aldrig ser helt tom ud.
