# Historik

Fanen **Historik** (`/historik`, spec 7.0): brugerens hændelser fra registreringen til nu, filtreret
med chips (Alle · Vejning · Mad · Mål), grupperet pr. dag med nyeste øverst og indlæst løbende,
når man scroller. Skærmen er designets `tabHistorik` (HTML-linje 1066–1096).

| Fil                   | Indhold                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `history.routes.ts`   | `HISTORY_ROUTES` – én rute (`''`) med `HistoryPage`.                                       |
| `models/history.ts`   | API-typerne (`HistoryEventDto`, `HistoryEventType`) og visningstyperne.                    |
| `services/history.ts` | `HistoryService` – henter siderne, mapper og grupperer posterne; filter og gen-log-status. |
| `pages/history-page/` | Skærmen.                                                                                   |

## Data

Kilden er `GET me/history?types=…&limit=50&cursor=…` (plan-v2 P17/A7): 50 hændelser pr. side,
nyeste først, hver med sin payload. Filteret sendes som `types`, så et filterskift starter forfra.
`AchievementCompleted` hentes aldrig – præstationerne afledes lokalt (P21).

| Type             | Filter    | Linje                                                                       |
| ---------------- | --------- | --------------------------------------------------------------------------- |
| `WeightRecorded` | `vejning` | "Vejning" · `75,0 kg`. Den første indlæste vejning får `Seneste vejning`.   |
| `FoodLogged`     | `mad`     | Madvarens navn · måltidet · `210 kcal`. Kan logges igen i dag.              |
| `GoalUpdated`    | `maal`    | "Mål opdateret" · målet (`Tabe mig` …) · dagligt kaloriemål (`2.010 kcal`). |
| `AccountCreated` | kun Alle  | "Konto oprettet" uden værdi.                                                |

`maal`-filteret virker nu: målændringerne kommer fra API'et (også dem, en vejning eller en
profilændring udløser).

**Registreringens mål skjules.** API'et opretter kontoen og det første mål med samme tidspunkt.
En `GoalUpdated` med præcis samme `occurredAt` som en indlæst `AccountCreated` vises derfor ikke,
så en ny konto kun viser "Konto oprettet" ("Kun registrering → vis kun den"). Det regnes over
**alle** indlæste sider: API'et sorterer `GoalUpdated` før `AccountCreated` ved samme tidspunkt, så
målet kan ligge sidst på én side og kontoen først på den næste – målet forsvinder, når kontoen er
hentet. Under "Mål" hentes `AccountCreated` ikke, og det første mål bliver stående.

Hver dag med måltider får under etiketten dagens samlede kalorier og makroer
(`1.970 kcal · P 120 g · K 210 g · F 60 g`), summeret af måltidernes payload. Den sidste indlæste
dag får ingen opsummering, så længe der er flere sider – dagen kan fortsætte på næste side.

## Indlæsning og fejl

- Første side hentes, når siden åbnes. Mens en side hentes, står en spinner nederst i listen.
- Scroller man inden for `HISTORY_LOAD_MORE_THRESHOLD_PX` af bunden, hentes næste side
  (`nextCursor`). Der spørges ikke, mens en side hentes, efter sidste side eller efter en fejl.
- Fejler en side, bliver de hentede poster stående, og nederst står fejlbeskeden
  (`UiFormError`) og "Prøv igen", der henter samme side igen.
- Tom tilstand (`UiEmptyState`) vises kun, når siden er hentet uden poster (fx under et filter).

## Beslutninger

- **Servicen leveres af siden**, ikke `providedIn: 'root'`. Siderne, filteret og
  gen-log-status hører til skærmen og nulstilles, når man forlader fanen. `DestroyRef` dropper
  en side på vej og rydder 2,6-sekunders-timeren.
- **Gen-log** (`redo`-ikonet) kalder `FoodLogService.add(food, meal)`; historikken genindlæses
  ikke. Tryk på et måltid, mens dets kald kører, ignoreres – også når et andet måltid gen-logges
  imens (ét tryk = én logning). Knappen bliver grøn (`Logget i dag`) eller rød med et kryds
  (`Ikke logget – prøv igen`) i 2,6 sekunder; kun det seneste svar vises. Teksten står i
  `aria-label` og `title` som i designet.
- **Tal formateres dansk** med `formatInteger` / `formatDecimal`.
