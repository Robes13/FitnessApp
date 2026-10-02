# FitnessApp API – mangler set fra mobilappen

> **Status 2026-10-01.** Integrationen er færdig (se `README.md`). API'et er ændret minimalt efter
> `plan-v2.md` §3; det, der er løst, står samlet under "Løst i denne runde". Alt andet nedenfor er
> stadig åbent og tjekket mod C#-koden på `feat/api-integration`. ⏸️ = bevidst ikke lavet (beslutning
> i `plan-v2.md`).

**Top 5 – det vigtigste, der mangler**

1. 🔴 Stop med at udlevere en SAS-token for hele containeren i `profileImageUrl`, og rotér de committede hemmeligheder (SAS og JWT-nøgle).
2. 🟠 E-mails sendes efter commit uden outbox – en fejlet afsendelse logges nu (ingen 500), men mailen går tabt, til brugeren beder om den igen.
3. 🟠 Ubekræftede konti sidder fast: de kan ikke skifte e-mail, et nyt register giver 409, og de udløber aldrig.
4. 🟠 Et delt fødevarekatalog med stregkodeopslag på serveren – i dag søger hver bruger kun i sine egne varer, så "ikke fundet" er normalen for en ny bruger.
5. 🟠 Næring kan kun angives pr. 100 g – portioner og stk. gemmes via en syntetisk serving på 100 g, så "per100" er misvisende data.

Alvorsgrad: 🔴 blokerer en funktion eller er et sikkerhedshul · 🟠 vigtig – appen har en
midlertidig løsning, men den er skrøbelig eller giver dårlig UX · 🟡 mindre / nice-to-have.

---

## Løst i denne runde

- **A1** Login med e-mail eller brugernavn; adgangskoden tjekkes før aktiveringen, 403 ved ubekræftet e-mail, lockout 5 forsøg / 15 min, brugernavne uden `@`.
- **A2** Verifikationsmail med link til en API-side (`GET auth/email/verify`), resend med identifikator; appen opdager bekræftelsen ved login-polling.
- **A3** Glemt adgangskode med e-mail eller brugernavn og en API-hostet nulstillingsside (GET forbruger ikke tokenet).
- **A4** Refresh samme UTC-dag giver det samme refresh-token.
- **A5** E-mailskift uden deaktivering (`EMAIL_VERIFICATION_TOKEN.NewEmail`); adressen skiftes, når linket trykkes.
- **A6** Påkrævet `mealType` på madlog og samlingslog, returneret i `FoodLogDto`.
- **A7** Historik med payload (`foodLog`, `weightLog`, `goal`) på `HistoryEventDto`.
- **A8** Dataeksport som download (`Content-Disposition: attachment`) via et kortlivet token i query-strengen.
- **A10** Profilbilleder gemmes lokalt i Development; compose (Postgres + migration + API) ligger i `docker/`.
- **A11** De tomme stub-controllere er slettet, og `Migrations/README.md` er rettet.
- **Overløb** (`c2ad5e4`): per-100-værdier, serving-gram og madlog-mængder/-totaler over `numeric(7,2)`/`numeric(9,2)` giver 400 i stedet for 500.
- **Målrækker** (`4f1e827`, delvist): genberegning efter vejning eller profilændring opretter kun en ny `UserGoal`, når tallene ændres. Intet `source`-felt endnu (se Profil & mål).
- **Merge med `main`** (2026-10-02, Roberts `8563897`): brugernavne efter `UsernameRules` og uden forskel på store og små bogstaver (`NormalizedUsername`, unikt indeks, samtidig dublet → 409), resend højst én mail pr. konto pr. minut, mails via Resend uden for Development, og en fejlet afsendelse giver ikke længere 500. Se `README.md`.
- **Produktregler bekræftet:** mindst én vare i en samling (P13) og API'ets grænser for adgangskode, brugernavn, højde og alder (P8; 13 eller 16 år er et åbent spørgsmål).

## Tværgående / infrastruktur

- 🟠 **E-mail sendes efter commit uden outbox.** `AccountMessageSender.SendAsync` kaldes efter `CommitAsync` i `RegisterAsync`, `ResendVerificationAsync`, `ForgotPasswordAsync` og `UserAccountService.UpdateAsync` (e-mailskift). Siden mergen logger den en fejl fra `SmtpEmailService` som en advarsel i stedet for at give 500 (kontoen findes, og resend/glemt/PATCH igen virker), men mailen går tabt, og brugeren ser ingen fejl. Forslag: send via en outbox-tabel i samme transaktion med genforsøg.
- 🟡 **Race conditions giver 500 i stedet for 409.** Unikhed tjekkes før `SaveChanges`, uden at Npgsql `23505` fanges: to samtidige `POST /me/weight-logs` samme dag (appen viser gem-fejlen; et nyt tryk giver overskrivningsspørgsmålet), dobbelttryk på `POST /auth/register` (siden mergen: 409, når det er brugernavnet, der støder sammen; ikke e-mailen), første samtidige `PUT /me/settings/{key}` og to konti, der bekræfter den samme nye e-mail samtidig (bør være 400). `Food (CreatedByUserId, Name)` har intet unikt indeks. Forslag: map `23505` til 409 overalt (`GlobalExceptionHandler` gør det i dag kun for brugernavnsindeksene; vægt: `WeightDateConflictException` med `existingWeightLogId`) og tilføj indekset.
- 🟡 **Manglende og urimelige værdier accepteres.** Positionelle records med værdityper får ingen implicit `[Required]`: et manglende `consumedAt` (`CreateFoodLogRequest`, `LogMealCollectionRequest`) eller `recordedAt` (`CreateWeightLogRequest`) bliver `0001-01-01`, og `CreateReminderRequest` uden felter giver 201. Datoer i fremtiden og før kontoen blev oprettet accepteres (UI-testen: en vejning og en madlog før `USER.CreatedAt` gav 201, og historikken viste dem før "Konto oprettet", mod 7.0). Appen sender altid "nu". Forslag: nullable + `[Required]`, og afvis datoer før `CreatedAt` og efter `now + ~5 min`.
- 🟡 **Manglende felt giver `errors.$`.** DTO'er med C# `required` afvises af JSON-deserialiseringen, før model-valideringen kører, så et manglende felt giver `errors["$"]` + `errors.request` i stedet for feltnavnet (fx login uden `emailOrUsername`). Et tomt felt giver `errors.EmailOrUsername` som i kontrakten.
- 🟡 **Dato- og tidsformater er ikke faste.** `RequestGuards.NormalizeUtc` gør en `DateTime` uden offset til UTC, output har 0–7 decimaler, og `reminderTime` returnerer brøkdele (`"18:30:15.5000000"`). Forslag: afvis `DateTime` uden offset, skriv et fast format (3 decimaler + `Z`) og `reminderTime` som `"HH:mm"`.
- 🟡 **API'et kan ikke køres lokalt uden compose.** `Program.cs` kører ikke `Database.Migrate()`, der er ingen seed-data, og `AzureBlobStorageOptions` kræver en HTTPS-`ContainerUrl` (ingen Azurite). Compose-filen i `docker/` dækker det for appen; flyt den gerne til `API/`.
- 🟡 **`/health` tjekker ikke databasen.** `AddHealthChecks()` uden checks svarer `Healthy`, også når Postgres er nede. Forslag: `AddDbContextCheck<FitnessAppDbContext>()`, evt. som `/health/ready`.
- 🟡 **Opstart kræver mange kald (nice-to-have).** Profilen alene kræver 5 (`/me`, `/me/profile`, `/me/goals/current`, `/me/settings`, `/me/weight-logs/latest`) plus `POST me/goals/recalculate`; derefter madvarer, madlog (90 dage), vejninger og samlinger. Forslag: `GET /api/v1/me/summary`.
- ⏸️ **Ingen idempotens på oprettelser** (P23). Et retry efter timeout giver dubletter i `POST /me/food-logs` og `…/meal-collections/{id}/log`; appen deaktiverer CTA'er under kald. Forslag: `Idempotency-Key`-header.
- ⏸️ **Ingen fejlkoder, fire fejlformer** (P6). Appen mapper status + felter og skelner de to 409'ere på `detail` (`/username/i`). Ændres "That username is already in use." eller "An account with that email already exists.", skal appen følge med. Forslag, når en ny UI-gren kræver det: én `application/problem+json` med en stabil `code`.
- ⏸️ **Ingen CORS** (P22). Browseren bruger dev-proxyen, native `CapacitorHttp`, og API-siderne er same-origin. Kræves først, hvis en web-build skal kalde API'et fra et andet origin.

## Auth & konto

- 🟠 **Ubekræftede konti sidder fast.** `PATCH /me` kræver et bekræftet token, et nyt `register` giver 409 (den ventende konto holder e-mail og brugernavn), `password/forgot` sender intet til ubekræftede konti, og de udløber aldrig. Forslag: anonymt `POST /auth/email/change-pending { emailOrUsername, password, newEmail }` (eller lad register overskrive en ubekræftet konto) og oprydning efter fx 7 dage. ("Ændre mail" er fjernet fra verifikationsmodalen.)
- 🟡 **`PATCH /me` tilbage til den nuværende e-mail annullerer ikke et ventende skift**; linket til den nye adresse virker stadig i 24 timer.
- 🟡 **Tilbagetrækning af samtykke sletter kontoen uden at registrere tilbagetrækningen.** `POST /me/consents/{Terms|HealthDataProcessing}/withdraw` kalder `SoftDeleteAsync` uden adgangskode og uden at det står i Swagger. Appen bruger det bevidst som 9.2-3b (P20), men samtykkerækkerne slettes uden at `WithdrawnAt` sættes. Forslag: sæt `WithdrawnAt` før sletningen, og dokumentér sideeffekten.
- 🟡 **Helbredsdata-samtykke og dokumentversioner.** Register opretter kun `Terms` (`Consent:TermsVersion`), og klienten skal gætte `documentVersion` til `POST /me/consents`. Forslag: `GET /api/v1/metadata` → `documents: [{ consentType, version, url }]` (og en side med vilkårene, se README "Før produktion").
- 🟡 **Dataeksporten.** `UserDataExportService` henter `FoodLogs` uden `!IsDeleted`, og `FoodLogDto` har intet `isDeleted`, så soft-slettede logs ligner rigtige. Et ugyldigt/udløbet token eller en slettet bruger giver rå engelsk problem-JSON i browseren (verify/reset har tosprogede HTML-sider). Påmindelser er lokale (P18) og kommer ikke med. Forslag: filtrér slettede logs fra og giv 404 som en tosproget HTML-side.
- 🟡 **Forkert nuværende adgangskode giver 401.** `POST /auth/password/change` svarer `401 "Current password is invalid."` med et gyldigt access-token, så en interceptor, der tolker 401 som udløbet token, prøver refresh. Appen bruger ikke endpointet. Forslag: 400 eller 403.
- 🟡 **Log ud kræver et gyldigt access-token og rydder ikke push-enheden.** `POST /auth/logout` er `[Authorize]`, og `UserDevice` slettes ikke. Forslag: `[AllowAnonymous]` logout, der kun validerer `refreshToken`, med et valgfrit `deviceToken`.
- ⏸️ **Log ud markerer refresh-tokenet `Revoked`** i stedet for at slette det (spec 1.3; funktionelt det samme, P22).
- ⏸️ **Ugyldigt verify-link sender ikke automatisk en ny mail** (spec 1.1-4a); siden beder brugeren trykke "Send mail igen" i appen (A2).
- ⏸️ **`HEAD` på de API-hostede HTML-sider giver 405** (kun GET), så en HEAD-request aldrig forbruger et verify-token. Tjek headers med GET (`curl -s -D - -o /dev/null <link>`), som forbruger tokenet.

## Profil & mål

- 🟡 **Automatiske målændringer kan ikke skelnes fra brugerens egne.** Rækker oprettes nu kun, når tallene ændres, men `RecalculateAsync` skifter stadig lydløst til `MaintainWeight`, når målvægten nås, og svaret fra vægt- og profil-endpoints siger ikke, at målet er ændret. Forslag: et `source`-felt på `UserGoalDto` (`User | WeightRecalculation | ProfileChange | TargetReached`) og `goalChanged` i svarene. (Appen henter `GET /me/goals/current` efter hver ændring.)
- 🟡 **`MaintainWeight` kræver præcis decimal-lighed.** `GoalCalculator` giver 400, hvis `targetWeight != currentWeight` eller tempoet ≠ 0; afviger appens lokale vægt (fx afrundet) fra serverens decimal, fejler "hold". Forslag: lad serveren selv bruge den nuværende vægt og tempo 0 (som `RecalculateAsync` gør).
- 🟡 **`GET /me/goals/current` giver 404 for en konto uden mål**, og så fejler også `recalculate`, så profilens load ender i `error`. Rammer ikke konti oprettet via register. Forslag: 200 med `null`.
- 🟡 **Alderen regnes på serverens UTC-dato**, appen på enhedens lokale dato; omkring midnat kan en grænsedato give 400 (vises som ugyldig fødselsdato).
- 🟡 **Dev-billed-URL'en er relativ** (`/api/v1/dev-images/…`) og peger i en native dev-build på WebView'ets egen server, så billedet ikke vises. Kun Development.

## Mad & madlog

- 🟠 **Fødevaresøgning finder kun brugerens egne varer.** `FoodService.SearchAsync` filtrerer altid på `CreatedByUserId == userId`, `createdByMe` bruges ikke, og resultatet sorteres efter `FoodId`. Forslag: delte varer (nullable `CreatedByUserId` eller `isPublic`/`source`) i søgning og logning, relevanssortering og evt. `GET /me/foods/recent`.
- 🟠 **Intet stregkodeopslag på serveren.** `GET /foods?barcode=` finder kun brugerens egne varer, og API'et har ingen Open Food Facts-integration. (Appen slår op i brugerens indlæste katalog og derefter i OFF fra klienten.) Forslag: `GET /api/v1/foods/barcode/{code}`, der slår op i delte varer og derefter i OFF.
- 🟠 **Kravet om unikt navn blokerer import af scannede varer.** `POST`/`PATCH /foods` giver 409, når navnet findes hos brugeren, så to produkter med samme navn ikke begge kan importeres, mens stregkoder ikke dedupes. Forslag: unikhed på `(userId, barcode)`, når stregkoden er sat, og `existingFoodId` i 409.
- 🟠 **Næring kan kun angives pr. 100 g.** Appens egne varer pr. portion eller stk. gemmes med en syntetisk serving på `gramsPerUnit = 100`, så "per100" i praksis betyder pr. stk. Forslag: `nutritionBasis` (`Per100Gram | Per100Milliliter | PerServing`) på `Food`.
- 🟡 **Milliliter kræver en ekstra serving pr. vare.** Logning i `Milliliter` giver 400 uden en `FoodServing`, så appen kalder `PUT /foods/{id}/servings/Milliliter { gramsPerUnit: 1 }` for hvert flydende produkt. Forslag: `baseUnit` på `Food` eller 1 ml = 1 g som fallback.
- 🟡 **Opret vare kan ikke tage servings med.** Opret og log kræver 2–4 kald, og en fejl undervejs efterlader en halvt oprettet vare (appen genbruger den ud fra navnet). Forslag: `servings: [{ unit, gramsPerUnit }]` på `CreateFoodRequest`.
- 🟡 **Kataloget kan ikke hentes inkrementelt.** `GET /foods` har intet `updatedSince`/ETag, så appen henter hele kataloget (100 pr. side) ved hver opstart, og det vokser med hver scannet vare.
- 🟡 **Brugte varer kan hverken slettes eller arkiveres.** `DELETE /foods/{id}` giver 409, hvis en `FoodLog` peger på varen – også en soft-slettet. Forslag: `isArchived` på `Food` og ignorér soft-slettede logs i tjekket.
- 🟡 **`Food` mangler brand og kilde.** Forslag: `brand` og `source` (`Custom | OpenFoodFacts | System`) på `Food`, `CreateFoodRequest` og `FoodDto`.
- 🟡 **Ingen dagsfilter på madlog.** `GET /me/food-logs` tager kun `from`/`to` i UTC, mens `/me/nutrition/days` bruger profilens tidszone. Forslag: `?date=YYYY-MM-DD` i profilens tidszone.

## Samlinger

- 🟠 **Navn og varer kan ikke gemmes samlet.** `PATCH /me/meal-collections/{id}` tager kun `name`, og varer ændres ét kald ad gangen uden fælles transaktion (appen redigerer som diff og genindlæser ved fejl). Forslag: `PUT /me/meal-collections/{id}` med `{ name, items }` i én transaktion, der returnerer `MealCollectionDto`.
- 🟡 **`MealItemDto` mangler næring pr. vare**, selv om tallet regnes i `MealCollectionService.ToDto`. Appen skalerer selv ud fra `FoodDto`. Forslag: `nutrition: NutritionTotalsDto` på `MealItemDto`.
- 🟡 **Samlingsnavne er ikke unikke.** Appen kræver unikke navne (`isNameTaken`), API'et accepterer dubletter. Forslag: 409 i `MealCollectionService.CreateAsync`/`UpdateAsync`.
- 🟡 **`POST /me/meal-collections/{id}/items` håndhæver ikke loftet på 50 varer** (kun `CreateAsync` gør). Appen begrænser selv kladden til 50.

## Vægt

- 🟡 **En vejning kan afvises af målberegningen.** `RecalculateAsync` kører i samme transaktion som vejningen, så en profil, der ikke længere består reglerne (fx alder > 100), afviser selve vejningen med 400. Forslag: gem vejningen, og log fejl i genberegningen.
- 🟡 **Svaret viser ikke den gemte præcision.** Kolonnen er `numeric(5,2)`, men `WeightLogService.ToDto` returnerer værdien fra requesten (`72.345` ind, `72.35` ved næste GET). Forslag: `Math.Round(weight, 2)` før gem.
- 🟡 **`recordedDate` genberegnes ikke ved skift af tidszone**, så en ny vejning kan give en uventet 409 efter `PATCH /me/profile { timeZoneId }`.
- 🟡 **Intet upsert pr. dag (nice-to-have).** "Ny vejning samme dag" er `POST` → 409 → `PATCH`. Forslag: `PUT /me/weight-logs/by-date/{yyyy-MM-dd}`.

## Historik

- 🟡 **Historik-cursoren har sit eget format.** `HistoryService` koder cursoren som standard-Base64 med padding, alle andre lister bruger `CursorCodec` (base64url).

## Sikkerhed

- 🔴 **`profileImageUrl` udleverer en SAS-token for hele containeren, og hemmeligheder er committet.** `AzureBlobProfileImageStorage.GetUrl` hænger den konfigurerede SAS (`sr=c`, `si=sudo`) på alle billed-URL'er, også i dataeksporten, og både SAS-tokenet og `Jwt:SigningKey` ligger i `appsettings.json`. Forslag: SAS pr. blob med kun læseret og kort levetid, eller billedet via API'et; flyt hemmelighederne til miljøvariabler, og rotér begge.
- 🟡 **Rate limiting kun på login.** Login-lockouten ligger i hukommelsen pr. API-instans og nulstilles ved genstart, og et kendt brugernavn kan låses i op til 15 minutter. `verify` og `password/forgot` er ubegrænsede (⏸️ P23); `resend-verification` sender højst én mail pr. konto pr. minut (siden mergen). Ukendte identifikatorer springer PBKDF2 over, så svartiden afslører, om kontoen findes. Forslag: `AddRateLimiter` pr. IP og pr. identifikator, tælleren i databasen/Redis ved udskalering.
- 🟡 **Tokens i URL'er** (verify 24 t, reset 1 t, eksport 5 min, genbrugeligt inden for TTL) logges kun ikke, fordi `Microsoft.AspNetCore` står på Warning. Hold den der.
- 🟡 **Slet konto kræver ikke adgangskode.** `DELETE /api/v1/me` anonymiserer kontoen med kun et access-token. Forslag: kræv `password` eller et nyligt login.
- 🟡 **Tokenhåndteringen kan strammes.** Genbrug af et brugt refresh-token revokerer ikke token-familien, og efter `logout-all`, nulstilling og skift af adgangskode virker udstedte access-tokens i op til 15 min. Forslag: revokér familien ved genbrug, og en `TokenVersion`-claim, som `OnTokenValidated` tjekker.

## Dokumentation / Swagger

- 🟡 **Swagger dokumenterer kun 200.** Ingen controller har `[ProducesResponseType]`, så 201/204, 400/401/403/404/409/429, `existingWeightLogId` og sideeffekter (kontosletning ved samtykke-tilbagetrækning) er ikke beskrevet. Forslag: `[ProducesResponseType]` med `ProblemDetails`, XML-kommentarer og `required` i skemaerne.
- 🟡 **`/metadata` har kun enum-navne** og mangler `MealType`, `HistoryEventType`, valideringsgrænser, værdiformater for indstillinger og lofterne (10 enheder, 20 påmindelser).
- 🟡 **Ingen dev-adgang til mails i automatiske tests.** Mails ligger kun som filer i `.dev-outbox`. Forslag: et Development-only `GET /dev/outbox?email=`.

## Ikke længere relevant for appen

Funktionen er fjernet eller bevidst holdt lokal i `plan-v2.md`. Bliver den aktuel igen, ligger de
gamle forslag i git-historikken for denne fil.

- Manuelt kaloriemål (`kcalOverride`), adaptivt mål og forhåndsvisning af målet i signup (P7: kun API'ets mål).
- Træningsugedage/RPE, højdeenhed og gemt beskæring af profilbilledet (P9/P10: appen følger API'ets model og bager beskæringen ind).
- Samlingsikon og -måltid, gruppering af en logget samling, faste samlinger og retter (P13).
- Påmindelser pr. måltid og ugedag og server-push (P18: lokale notifikationer).
- Præstationer, der matcher designet (P21: afledes lokalt).
- `POST /me/food-logs/{id}/restore` uden body og `entryCount` på `NutritionDayDto` (appen bruger hverken fortryd eller `nutrition/days`).

## Noter fra UI-testen (app)

Ikke API-mangler, men stadig sande og værd at kende:

- Signup understreger "servicevilkår" og "privatlivspolitik", men de er ikke links, og der findes ingen side med vilkårene.
- Linealerne til vægt og højde har faste intervaller og klemmer en målvægt på den forkerte side af målet i stedet for at markere den (fortolkning af 1.0-2a–6a og 11a).
- Efter et e-mailskift viser Profil ikke, at et skift venter på bekræftelse, og appen ser den nye adresse først efter en genindlæsning eller et nyt login.
- Er kaloriemålet løftet til det sikre minimum, regner Hjems "du er der om ca. N uger" stadig med det valgte tempo.
- Mad-siden viser "tilbage i dag 0 kcal" og højst 100 % pr. makro, når målet er overskredet.
- Vægtgrafen placerer punkterne jævnt efter indeks, ikke efter dato.
- "Kg tabt"-præstationerne regner fra den første vejning, ikke fra startvægten fra registreringen.
- En egen vare pr. stk. eller portion vises i scanneren som en syntetisk portion på 100 g (`// ponytail:`), og en egen vare med forkerte tal kan ikke rettes i appen (P12; `PATCH /foods` bruges ikke).
- Efter en kold start med API'et nede genindlæser "Prøv igen" kun sidens egne stores; der er ingen automatisk genindlæsning, når forbindelsen kommer tilbage.
- Dataeksporten på web er en tavs browser-download uden besked i appen; på native skal det verificeres på en enhed.
- `WeightLogService.weighedToday` bruges kun af specs og flytter sig ikke ved midnat (Hjem regner selv); kan slettes.
- Engelsk `food.addSheet.logCollection` lyder "Log 370 kcal under Dinner"; "for Dinner" er mere naturligt.

## Allerede fint – behold det

- **JSON-konventionerne:** camelCase, enums som PascalCase-strenge (case-insensitive ind), UTC med `Z`, `DateOnly` som `yyyy-MM-dd` og eksplicitte `null`.
- **Paginering:** keyset med `{ items, nextCursor, hasMore }`, nyeste først og maks. 100 – ens på alle lister.
- **Register i én transaktion:** bruger, profil, første mål, notifikationsindstilling og Terms-samtykke oprettes samlet.
- **Auth-modellen:** kortlivet access-token + roterende refresh-token i JSON-body (ingen cookies), `AuthResponse.user`, og `OnTokenValidated` afviser slettede/deaktiverede brugere med det samme.
- **Ingen konto-enumeration:** `resend-verification` og `password/forgot` svarer altid 204.
- **Vægt:** én pr. dag med 409 + `existingWeightLogId`, og `GET /weight-logs/latest` med fallback til `startingWeight`.
- **Madlog og ernæring:** serverberegnet næring pr. log, soft delete og `goals/at` til historiske dage.
- **Samlinger:** totaler på `MealCollectionDto` og `…/log` i én transaktion.
- **Indstillinger:** validerede værdier for `Theme`, `Language`, `WeightUnit` og booleans.
- **Konto og data:** multipart-upload af profilbillede med type- og størrelsesgrænse, grundig anonymisering i `DELETE /me` og dataeksport.
- **`.dev-outbox` i Development:** mails med klikbare links gør signup og nulstilling nemme at teste manuelt.
