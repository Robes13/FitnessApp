# Påmindelser og push-enheder: mapning mellem app og API

Domæne: `ReminderService` / `reminder-notifier` / `profile-reminders-sheet` / signup `notifications-step`
mod `RemindersController`, `DevicesController`, `ReminderNotificationWorker` og Firebase.

Alt nedenfor er læst i C#-koden og **verificeret live** mod dev-API'et i Docker
(`http://localhost:5210`, compose-projekt `fitnessapp-dev`) med en testbruger, jeg selv oprettede.
Ingen filer i repoet er ændret.

---

## 1. Anbefaling (kort)

**Gem påmindelses-indstillingerne i API'et, og lad appen fortsat levere dem selv som lokale notifikationer.
Firebase og `/me/devices` tages IKKE i brug nu.**

Hvorfor:

- Appen har intet push-plugin (`@capacitor/push-notifications` er ikke installeret, og der er
  ingen `google-services.json` / `GoogleService-Info.plist` eller APNs-nøgle). Server-push
  kræver alt det plus et Firebase-projekt. Det er meget arbejde for noget, der allerede virker lokalt.
- `ReminderNotificationWorker` registreres kun, når `Firebase:ProjectId` er sat
  (`Program.cs`), og det er ikke sat i dev-compose. Serveren sender altså ingenting i dag.
- Uden en registreret enhed kan serveren alligevel aldrig sende noget
  (`FirebasePushNotificationService.SendAsync` returnerer `false`, når brugeren har 0 enheder).
  Der er derfor ingen risiko for dobbelte notifikationer, så længe appen ikke kalder `POST /me/devices`.
- Når indstillingerne ligger i API'et, følger de brugeren til en ny telefon, og de kommer med i
  `GET /api/v1/me/data-export` (`UserDataExportDto.Reminders`).

Hovedkontakten "Notifikationer" (`UserProfile.notificationsEnabled`) hører til indstillingerne
(`SettingKey.Notifications`) og mappes i profil/indstillinger-domænet. `ReminderService` læser den
som i dag via `UserProfileService`, og intet ændrer sig i den her service.

---

## 2. API-kontrakten, som den faktisk er

Fælles for alt:

- JSON: standard ASP.NET camelCase (`AddControllers().AddJsonOptions(...)` ændrer kun konverterne).
- Enums: `JsonStringEnumConverter` **uden** naming policy. Enums skrives som PascalCase-navne
  (`"LogFood"`, `"LogWeight"`, `"Android"`, `"Ios"`). Ved læsning er de case-insensitive
  (`"logfood"` virker), og tal accepteres også (`2` bliver til `LogWeight`). Verificeret.
- Alle endpoints: `[Authorize]` (Bearer-JWT med `token_type=access`, aktiv og e-mail-verificeret
  bruger). Mangler token, eller er det ugyldigt, svarer API'et `401` uden body.
- Fejl fra services er `ProblemDetails` `{ title, status, detail }`: 400 `BusinessValidationException`,
  404 `NotFoundException`, 409 `ConflictException`. Fejl ved model binding eller JSON er
  `ValidationProblemDetails` `{ type, title, status, errors: { "$.field": [...] }, traceId }` (400).
  `detail` er engelsk tekst, så appen skal selv mappe status til i18n-nøgler.
- **CORS er ikke konfigureret** (se gaps). En preflight `OPTIONS` giver `405` uden
  `Access-Control-*`-headere.

### 2.1 Reminders: `api/v1/me/reminders`

| Verb   | Route                                   | Body                                                    | Svar                                                                                                                                                         |
| ------ | --------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/api/v1/me/reminders`                  | –                                                       | `200` `ReminderDto[]`, **sorteret efter `reminderTime`** (ikke id). `[]` for en ny bruger.                                                                   |
| GET    | `/api/v1/me/reminders/{reminderId:int}` | –                                                       | `200` `ReminderDto` · `404` `"Reminder not found."`                                                                                                          |
| POST   | `/api/v1/me/reminders`                  | `CreateReminderRequest`                                 | **`201`** + `Location: /api/v1/me/reminders/{id}` + `ReminderDto` (Swagger siger fejlagtigt 200) · `400` · `409` `"At most 20 reminders can be configured."` |
| PATCH  | `/api/v1/me/reminders/{reminderId:int}` | `UpdateReminderRequest` (almindelig `application/json`) | `200` `ReminderDto` · `404` · `400`                                                                                                                          |
| DELETE | `/api/v1/me/reminders/{reminderId:int}` | –                                                       | `204` · `404`                                                                                                                                                |
| PUT    | –                                       | –                                                       | `405` (findes ikke)                                                                                                                                          |

```ts
// ReminderDto (svar)
{ reminderId: number; reminderType: 'LogFood' | 'LogWeight'; reminderTime: string; isEnabled: boolean }

// CreateReminderRequest
{ reminderType: 'LogFood' | 'LogWeight'; reminderTime: string; isEnabled: boolean }

// UpdateReminderRequest: alle felter valgfri. Kun felter, der ikke er null, bliver ændret.
{ reminderType?: 'LogFood' | 'LogWeight' | null; reminderTime?: string | null; isEnabled?: boolean | null }
```

Regler og faldgruber (alle verificeret):

- `reminderTime` er en `TimeOnly`, gemt som `time without time zone`, **uden tidszone**.
  Serveren tolker den i profilens `TimeZoneId`, men kun i workeren. Lokale notifikationer
  fyrer i telefonens lokale tid, og det passer fint.
  - Ind: `"08:00"`, `"08:00:00"` og endda `"7:5"` (bliver til `07:05:00`) accepteres. `"24:00"`
    og `null` giver `400` ValidationProblem på `$.reminderTime`.
  - Ud: altid `"HH:mm:ss"`, f.eks. `"09:15:00"`. **Sender man sekunder eller brøkdele, kommer de
    retur**: `"18:30:15.5"` bliver til `"18:30:15.5000000"`. Appen skal derfor parse
    `reminderTime.slice(0, 5)`.
- `reminderType`: `0` eller manglende felt giver `400` `"ReminderType is invalid."`. En ukendt
  streng giver `400` ValidationProblem på `$.reminderType`.
- **Manglende felter i POST bliver stille til default-værdier**: `{"reminderType":"LogFood"}`
  giver `201` med `reminderTime "00:00:00"` og `isEnabled false`. Appen skal altid sende alle tre felter.
- PATCH `{}` eller alle felter `null` er en no-op og giver `200`. Ukendte felter ignoreres.
  `reminderType` kan ændres.
- Højst 20 påmindelser pr. bruger (tælles ved POST). **Intet unikt indeks** på (bruger, type),
  så flere med samme type er tilladt.
- `reminderId` er en global serial. Hver ny påmindelse får et højere id end de tidligere, også på tværs af brugere.
- Kontosletning (`DELETE /api/v1/me`) sletter påmindelser og enheder (`UserAccountService`).

### 2.2 Devices: `api/v1/me/devices` (bruges ikke nu)

| Verb   | Route                               | Body                                                                         | Svar                                                                                                                                                                                                                                               |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/me/devices`                | –                                                                            | `200` `UserDeviceDto[]`, nyeste først, højst 10                                                                                                                                                                                                    |
| POST   | `/api/v1/me/devices`                | `{ token: string (20–4096 tegn, [Required]), platform: 'Android' \| 'Ios' }` | **`201`** `UserDeviceDto` (Swagger siger 200, og der er ingen Location). Samme token igen er en upsert: samme `userDeviceId`, og ejer/platform/`registeredAt` opdateres. `400` for et kort token · `409` `"At most 10 devices can be registered."` |
| DELETE | `/api/v1/me/devices/{deviceId:int}` | –                                                                            | `204` · `404` `"Device not found."`                                                                                                                                                                                                                |

`UserDeviceDto = { userDeviceId: number; platform: 'Android' | 'Ios'; registeredAt: string /* ISO UTC */ }`.
Tokenet gemmes krypteret (DataProtection) og som hash og returneres aldrig.

### 2.3 Relaterede indstillinger (ejes af profil/indstillinger-domænet)

`PUT /api/v1/me/settings/{key}` med `{ "value": "true" | "false" }` (key er case-insensitive,
`notifications` virker). Svaret er `200 { settingKey, settingValue, updatedAt }`, og alt andet end
true/false giver `400`.

- `Notifications` hører sammen med appens `notificationsEnabled` (hovedkontakten). Den sættes ved registrering fra
  `RegisterRequest.notificationsEnabled`.
- `MealReminders` og `WeightReminders` findes i API'et, men appen har ingen tilsvarende kontakter.
  **Brug dem ikke.** De påvirker kun server-push.

---

## 3. Mapning mellem app og API

### 3.1 Typer

Appen har 5 faste slags påmindelser. API'et har kun 2 typer og hverken label, slot eller ugedag.

| App `ReminderId`     | App-default                 | API `reminderType` | Rækkefølge ved oprettelse |
| -------------------- | --------------------------- | ------------------ | ------------------------- |
| `morgen` (morgenmad) | off, 08:00                  | `LogFood`          | 1. `LogFood`              |
| `frokost`            | off, 12:00                  | `LogFood`          | 2. `LogFood`              |
| `aften` (aftensmad)  | off, 18:30                  | `LogFood`          | 3. `LogFood`              |
| `weigh-in`           | off, 07:30, `weekday: null` | `LogWeight`        | 1. `LogWeight`            |
| `daily-log`          | **on**, 21:00               | `LogFood`          | 4. `LogFood`              |

**Identifikation (workaround for gap 1):** Fire af appens slags er alle `LogFood`, og API'et
kan ikke skelne dem. Den enkleste løsning, der virker på tværs af enheder, er **en konvention
baseret på oprettelsesrækkefølge**:

- Appen opretter altid sine påmindelser i `REMINDER_DEFINITIONS`-rækkefølgen, **én ad gangen**
  (hver POST afventes), så id'erne stiger i den rækkefølge.
- Appen sletter dem aldrig. "Slå fra" er `PATCH { isEnabled: false }`.
- Ved indlæsning grupperes svaret efter `reminderType`, hver gruppe sorteres efter `reminderId`
  stigende, og den n'te `LogFood` bliver den n'te `LogFood`-definition, den første `LogWeight`
  bliver `weigh-in`. Overskydende rækker (f.eks. dubletter, hvis to enheder seeder samtidigt)
  ignoreres.
- GET-svaret er sorteret efter tid, så **appen skal selv sortere efter id**.

Konventionen er skrøbelig, hvis en anden klient opretter eller sletter påmindelser. Derfor gap 1.

### 3.2 Felter

| App (`ReminderSetting`)                          | API (`ReminderDto`)                  | Mapning                                                                                              |
| ------------------------------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `enabled: boolean`                               | `isEnabled: boolean`                 | 1:1                                                                                                  |
| `time: { hour, minute }`                         | `reminderTime: "HH:mm:ss[.fffffff]"` | ud: `formatClockTime(time)` (`"07:30"` accepteres) · ind: `parseClockTime(reminderTime.slice(0, 5))` |
| `weekday: WeekdayIndex \| null` (kun `weigh-in`) | **findes ikke**                      | Gemmes kun lokalt (`STORAGE_KEY.REMINDERS`) indtil gap 2 er løst. Sendes aldrig.                     |
| –                                                | `reminderId: number`                 | Holdes i memory i `ReminderService` pr. `ReminderId` (bruges til PATCH).                             |

Ugedage: appen bruger `0` = mandag … `6` = søndag. Hvis API'et tilføjer .NET `DayOfWeek`
(Sunday=0 … Saturday=6, og med `JsonStringEnumConverter` bliver det til `"Monday"` …), skal der
mappes via navne, ikke tal.

### 3.3 Signup (`notifications-step`)

Intet påmindelses-specifikt. Valget ender i `profile.notificationsEnabled` og sendes som
`RegisterRequest.notificationsEnabled` (auth-domænet). API'et laver ingen påmindelser ved
registrering. Dem seeder appen ved første indlæsning efter login (se 4.2), så `daily-log` (on, 21:00)
kommer med.

---

## 4. Implementeringsplan (det mindste, der virker)

Forudsætninger fra andre domæner (genbruges, bygges ikke her): en fælles API-base-URL,
`HttpClient` med Bearer-interceptor og refresh (auth-domænet) og en løsning på CORS
(dev: Angular-proxy `/api` til `http://localhost:5210`, native: `CapacitorHttp` eller CORS i API'et).

### 4.1 Modeller og konstanter

- `core/models/reminder.ts`: tilføj backend-typerne (holdes adskilt fra UI-modellen):
  `ReminderApiType = 'LogFood' | 'LogWeight'`, `ReminderDto`, `CreateReminderRequest`,
  `UpdateReminderRequest` (felterne som i 2.1).
- `core/constants/reminders.ts`: giv hver `ReminderDefinition` en `apiType: ReminderApiType`
  (morgen/frokost/aften/daily-log = `'LogFood'`, weigh-in = `'LogWeight'`). Rækkefølgen i
  `REMINDER_DEFINITIONS` er nu kontrakt, så skriv det i kommentaren.
  Endpoint-stien `'/api/v1/me/reminders'` lægges som konstant (samme sted som de andre
  API-endpoints, jf. "ingen magic strings").

### 4.2 `core/services/reminders/reminders-api.ts` (ny, tynd)

`RemindersApi` med `list()`, `create(req)`, `update(id, req)`, hver en `HttpClient`-linje
(samme mønster som `AuthApi`). Ingen DELETE, fordi appen ikke skal bruge det.

### 4.3 `ReminderService`: ændringer

1. **Behold** `settingsState` og cachen i `STORAGE_KEY.REMINDERS`. Så er UI'et klar med det samme
   ved app-start og offline, og cachen er også stedet, hvor `weekday` gemmes.
2. Nyt felt `serverIds: Partial<Record<ReminderId, number>>` (i memory).
3. `load()`, der kører, når `session.isLoggedIn()` bliver `true` (tilføjes til den eksisterende
   `effect`, eller en lille egen):
   - `GET` og så `match(dtos)` som i 3.1. For hver matchet slags overskrives `enabled` og `time`
     fra serveren, og `weekday` beholdes lokalt. Resultatet gemmes i storage, og `sync()` kører
     af sig selv via `effect`.
   - Mangler der slags (ny bruger, eller første login efter lokal brug), oprettes de **sekventielt**
     i definitionsrækkefølge med de nuværende lokale værdier (`POST { reminderType, reminderTime, isEnabled }`).
     Lokale valg fra før API'et bevares på den måde.
4. `update(id, patch)`: som i dag (optimistisk og gem lokalt). Rører patchen `enabled` eller `time`,
   og `serverIds[id]` er kendt, sendes `PATCH` med kun de ændrede felter
   (`{ isEnabled }` / `{ reminderTime: formatClockTime(time) }`). `weekday` sendes ikke.
   PATCH'es køres gennem en promise-kø ligesom den eksisterende `queue`. Tidsfeltet sender flere
   værdier efter hinanden, og køen sikrer, at det sidste svar vinder.
5. Fejl: ny `REMINDER_ERROR_KEY.SAVE` (`core.reminders.error.save` i `da.json` og `en.json`), som vises
   gennem den eksisterende `error`-signal. Den lokale ændring beholdes, og næste `load()` henter
   serverens sandhed igen. `console.error` som i dag, så der ingen tavse catches er.
6. Log ud: nulstil `serverIds`, og nulstil indstillingerne til `DEFAULT_REMINDER_SETTINGS`. Ellers
   ville en ny bruger på samme telefon få den forrige brugers valg seedet ind i sin konto.

`reminder-notifier.ts`, `profile-reminders-sheet.*` og `notifications-step.*` ændres **ikke**.
Arket arbejder kun gennem `ReminderService` og viser allerede `error()`.

### 4.4 Tests

- `reminders-api.spec.ts` (`provideHttpClientTesting`): verb, URL og body for list/create/update.
- `reminders.spec.ts` (udvid med fake `RemindersApi`):
  - Indlæsning mapper LogFood efter id-rækkefølge (også når svaret er sorteret efter tid), og
    `weekday` bevares lokalt.
  - `[]` fra serveren seeder 5 POSTs i definitionsrækkefølge med de lokale værdier, én ad gangen.
  - Delvist sæt: kun de manglende oprettes. Dubletter ignoreres.
  - `"18:30:15.5000000"` bliver til `{18,30}`.
  - `update(enabled)` / `update(time)` giver en PATCH med kun det felt. `update(weekday)` giver ingen PATCH.
  - En PATCH-fejl giver `error()` = SAVE-teksten, og den lokale værdi bevares.
  - Log ud nulstiller til defaults.
- UI-test: `npm start` med proxy mod dockeren. Opret en testbruger, slå frokost til og skift tid i
  arket, genindlæs, og tjek at værdien kommer fra `GET /me/reminders`. Log ind på en "ny enhed"
  (ryd storage), og tjek at indstillingerne følger med, undtagen ugedag.

---

## 5. Gaps til API-teamet

1. **[major] Påmindelser kan ikke identificeres pr. måltid.** Appen har morgenmad, frokost,
   aftensmad og "dagens madlog", og alle fire er `LogFood` uden label. Forslag: udvid `ReminderType`
   (f.eks. `Breakfast`, `Lunch`, `Dinner`, `DailyLog`, og behold `LogFood`/`LogWeight` for
   bagudkompatibilitet) eller tilføj et `slot`/`label`-felt på `ReminderDto`, `CreateReminderRequest`
   og `UpdateReminderRequest`, gerne med unikt indeks på (UserId, slot). Workeren skal så
   behandle de nye typer som mad (`MealReminders`, tekst). Appens workaround er en
   rækkefølge-konvention på `reminderId`.
2. **[major] Ingen ugedag.** Vejningen kan i appen sættes til "hver dag" eller én ugedag, og API'et
   kan kun gemme "hver dag". Forslag: `daysOfWeek: DayOfWeek[]` på entitet og DTO'er, hvor
   tom/null betyder hver dag, og workeren sender kun på matchende lokale dage. Bemærk at PATCH i dag
   bruger `null` = "ingen ændring", så "ryd ugedag" kræver en eksplicit værdi (f.eks. `[]`).
   Appens workaround er at ugedagen kun gemmes lokalt og ikke følger brugeren.
3. **[major] Ingen CORS.** Hverken `AddCors` eller `UseCors` er sat op, og preflight giver `405`.
   Browser-dev (`localhost:4200`) og Capacitor-WebViews (`capacitor://localhost`, `https://localhost`)
   bliver blokeret. Forslag: CORS-policy for de origins. Workaround: dev-proxy og `CapacitorHttp`.
4. **[minor] Ingen idempotent oprettelse eller bulk-upsert.** Seeding kræver 5 sekventielle POSTs,
   og to enheder, der seeder samtidigt, laver dubletter (intet unikt indeks, kun grænsen på 20).
   Forslag: `PUT /api/v1/me/reminders/{slot}` (upsert) eller `PUT /api/v1/me/reminders` (hele sættet).
5. **[minor] POST accepterer manglende felter.** `{"reminderType":"LogFood"}` giver `201` med
   `00:00:00` og `isEnabled:false`. Forslag: `[Required]` / `required` på `ReminderTime` og `IsEnabled`.
6. **[minor] `reminderTime` beholder sekunder og brøkdele** (`"18:30:15.5000000"`). Forslag: afrund
   eller afvis alt under minutter, og returnér fast `"HH:mm"` eller `"HH:mm:ss"`.
7. **[minor] Swagger passer ikke med virkeligheden:** `POST /me/reminders` og `POST /me/devices`
   dokumenteres som `200`, men svarer `201`. Tilføj `[ProducesResponseType]` (også 400/404/409).
8. **[minor] Workeren laver arbejde uden modtager** (kun når Firebase er slået til):
   `ClaimAsync` indsætter en `REMINDER_DELIVERY`-række _før_ den tjekker, om brugeren har enheder.
   Hver slået-til påmindelse hos en bruger uden enheder får derfor en række om dagen, som
   reclaimes hvert 5. minut i 24 timer og aldrig får `SentAt`. Forslag: filtrér på
   `User.UserDevices.Any()` i forespørgslen.
9. **[minor] Server-push og lokale notifikationer kan give dubletter.** Slås Firebase til, og
   registrerer appen en enhed, kommer hver påmindelse to gange. Før push tages i brug, skal man
   aftale én leveringsvej (f.eks. et felt på enheden eller i indstillingerne om, at serveren
   leverer).
10. **[minor] Push-tekster er hardkodet på engelsk** (`"Food reminder"` / `"Weight reminder"`) og
    ignorerer `SettingKey.Language` og måltid. Det betyder kun noget, hvis server-push tages i brug.
11. **[minor] Log ud fjerner ikke enheden.** `POST /auth/logout` sletter ikke `UserDevice`, og
    `DELETE /me/devices/{id}` kræver, at klienten husker id'et. En udlogget telefon får fortsat
    push for kontoen. Forslag: `deviceToken`/`deviceId` i logout-requesten eller
    `DELETE /me/devices?token=`. Det betyder kun noget med server-push.
