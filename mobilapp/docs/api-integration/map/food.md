# Mad-domænet: app ↔ API (madvarer, søgning, stregkode, madlog)

Kilde: læst C#-kode i `/Users/janick/Documents/GitHub/FitnessApp/API` (Controllers, DTOs, Services,
Domain, Utilities, Data/FitnessAppDbContext.cs, Program.cs) og app-koden i
`/Users/janick/Documents/GitHub/FitnessApp/mobilapp/src/app`. Ruter og skemaer er bekræftet mod
den kørende dev-container `fitnessapp-dev-api-1` (`http://localhost:5210`, swagger + `/api/v1/metadata`).
Ingen kald med token blev lavet (der er ingen testbruger, og opgaven var read-only).

---

## 0. Kort svar på nøglespørgsmålene

| Spørgsmål                                       | Svar (fra koden)                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Har API'et en egen fødevaredatabase og søgning? | **Nej, ikke en delt.** `GET /api/v1/foods` returnerer **kun madvarer, den kaldende bruger selv har oprettet** (`CreatedByUserId == userId` altid; `createdByMe` bliver taget imod, men bruges ikke). Det svarer til appens søgning i dag, som kun finder brugerens egne varer.                                                         |
| Kan API'et slå en stregkode op?                 | Kun i brugerens **egne** madvarer (`GET /api/v1/foods?barcode=…`, eksakt match). Der er ingen Open Food Facts-integration på serveren.                                                                                                                                                                                                 |
| Beholder appen Open Food Facts?                 | **Ja.** Appen slår op i OFF, opretter derefter varen i API'et (`POST /api/v1/foods` med `barcode`) og logger den. Næste scan af samme stregkode findes i brugerens katalog (eller lokalt i den indlæste liste), uden at OFF bliver kaldt igen.                                                                                         |
| Hvordan ser en logget vare ud?                  | `FoodLog`: `foodId` + `quantity` (decimal) + `unit` (`QuantityUnit`) + `consumedAt` (UTC-tidspunkt). **Der er ingen måltidstype** (morgen/frokost/aften/snack). Det er den største mangel.                                                                                                                                             |
| Hvordan beregnes næringsværdier?                | Serveren: `gram = quantity` (Gram) eller `quantity × servings[unit].gramsPerUnit`; værdi = `per100 × gram / 100`, afrundet til 2 decimaler (`AwayFromZero`). Værdierne gemmes på loggen som et **snapshot**, så en senere rettelse af varen ikke ændrer gamle logs. `PATCH` på en log genberegner ud fra varens værdier, som de er nu. |
| Måltidsmapping (enum)?                          | **Findes ikke.** Midlertidig løsning i appen: måltidet kodes som et fast tidspunkt på dagen i `consumedAt` (se §3.3).                                                                                                                                                                                                                  |
| Hente en dags log?                              | Der er ingen `days/{date}` under food-logs. Brug `GET /api/v1/me/food-logs?from=<lokal midnat som UTC>&to=<næste lokale midnat som UTC>&limit=100` og følg `nextCursor`. Summer for dage findes på `GET /api/v1/me/nutrition/days/{yyyy-MM-dd}` og `…/days?from&to` (dagsgrænser efter profilens tidszone).                            |
| Slette og gendanne?                             | `DELETE /api/v1/me/food-logs/{id}` er en blød sletning (204). `POST /api/v1/me/food-logs/{id}/restore` giver 204 uden body.                                                                                                                                                                                                            |
| Paginering?                                     | Cursor-baseret: `{ items, nextCursor, hasMore }`. Foods: nyeste `foodId` først, `limit` er 30 som standard og højst 100. Food-logs: `consumedAt` faldende, derefter `foodLogId` faldende, `limit` er 50 som standard og højst 100. En ugyldig cursor giver 400.                                                                        |

---

## 1. JSON- og HTTP-konventioner (Program.cs)

- `AddControllers().AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))`.
  Ud over det bruges ASP.NET's web-standard, så:
  - **Property-navne er camelCase** (`foodId`, `caloriesPer100`, `consumedAt`). Ved læsning er de ikke følsomme for store og små bogstaver.
  - **Enums skrives som C#-navnet uændret (PascalCase)**, fx `"Gram"`, `"Milliliter"`, `"Piece"`, `"Slice"`, `"Cup"`,
    `"Tablespoon"`, `"Teaspoon"`, `"Serving"`. Tal accepteres også ved læsning. `StringValueAttribute`
    bruges **ikke** af serializeren. Bekræftet: `/api/v1/metadata` giver
    `"quantityUnits":["Gram","Milliliter","Piece","Slice","Cup","Tablespoon","Teaspoon","Serving"]`.
  - `decimal` er JSON-tal (fx `52.00`). `DateTime` sendes som ISO 8601. Send **altid med `Z`** (`Date.toISOString()`).
    Uden offset tolkes værdien som UTC (`RequestGuards.NormalizeUtc`). Svar kommer i UTC med `Z` (Npgsql, `timestamptz`).
  - `DateOnly` (nutrition) skrives `"YYYY-MM-DD"`.
- Alle endpoints i domænet kræver `[Authorize]` (`Authorization: Bearer <access JWT>`). Uden token svarer API'et **401 uden body**
  (`WWW-Authenticate: Bearer`). Brugeren skal være aktiv og have verificeret e-mail, ellers fejler tokenet.
- Fejl (`GlobalExceptionHandler`) kommer som ProblemDetails: `{ "title", "status", "detail" }`:
  - 400 `"Validation failed"` (BusinessValidationException), 404 `"Resource not found"`, 409 `"Conflict"`,
    403 `"Forbidden"` (UnauthorizedAccessException), 500 `"Unexpected server error"`.
  - Fejl i model-binding/JSON (ugyldigt enum-navn, forkert JSON, manglende `name`) giver [ApiController]'s automatiske
    **ValidationProblemDetails**: `{ title: "One or more validation errors occurred.", status: 400, errors: { "$.unit": [...] } }`.
- **Ingen CORS** er konfigureret. Bekræftet: preflight `OPTIONS /api/v1/foods` gav `405`, og der var ingen `Access-Control-*`-headere.
  Browseren (`ng serve` på :4200) og Capacitor-WebView'et bliver derfor blokeret, se gap-listen. Løsning i dev:
  Angular dev-proxy (`/api` → `http://localhost:5210`) og `CapacitorHttp` på native.
- Tomme klasser `FoodController`, `FoodLogController`, `MealCollectionController` og `DashboardController`
  (namespace `API.Controllers`) er ikke controllere og har ingen ruter.
- `LogEntry` er en teknisk log-tabel (`MethodName`, `Message`, `Exception`, `RequestPath` …). Den har **intet med madlog at gøre**
  og har ingen endpoint.

---

## 2. API-reference for domænet (præcist fra koden)

### 2.1 Foods – `FoodsController` (`[Route("api/v1/foods")]`)

| Verb + rute                                         | Input                                                                                                                              | Svar                                                                  | Regler og fejl                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/foods`                                 | query: `query?`, `barcode?`, `createdByMe=false` (**bruges ikke**), `limit=30`, `cursor?`                                          | 200 `CursorPage<FoodDto>`                                             | Kun egne varer. `query` trimmes og matches med `ILIKE '%term%'` (escapet). `barcode` trimmes og skal matche eksakt. Sorteres efter `foodId` faldende. `limit ≤ 0` giver 30, højst 100. Servings er med. Ugyldig cursor: 400 `"The cursor is invalid."`                                                                                                                                                                                                       |
| `GET /api/v1/foods/{foodId:int}`                    | –                                                                                                                                  | 200 `FoodDto`                                                         | 404 `"Food not found."`, også hvis varen tilhører en anden bruger                                                                                                                                                                                                                                                                                                                                                                                            |
| `POST /api/v1/foods`                                | `CreateFoodRequest`                                                                                                                | **201** + `Location: /api/v1/foods/{id}` + `FoodDto` (`servings: []`) | `name` er påkrævet, 1–150 tegn og trimmes. `barcode` må højst være 100 tegn, blank bliver `null`, og den trimmes. Makroer skal være `≥ 0` (400 `"CaloriesPer100 cannot be negative."`). Mangler en makro, bliver den 0. Præcisionen er `numeric(7,2)`, så højst 99999.99. **409 `"A food with that name already exists in your catalogue."`** hvis brugeren har en vare med samme navn (uden hensyn til store og små bogstaver). Stregkoder må godt gå igen. |
| `PATCH /api/v1/foods/{foodId:int}`                  | `UpdateFoodRequest` (alle felter nullable, `null` betyder uændret)                                                                 | 200 `FoodDto`                                                         | `name: ""` giver 400 `"Name cannot be empty."`. `barcode: ""` fjerner stregkoden. Dublet-navn giver 409. En andens vare giver 403. En ukendt vare giver 404. **Eksisterende logs genberegnes ikke.**                                                                                                                                                                                                                                                         |
| `DELETE /api/v1/foods/{foodId:int}`                 | –                                                                                                                                  | 204                                                                   | **409**, hvis varen bruges af en food log (også soft-deleted) eller af et meal item. En andens vare giver 403.                                                                                                                                                                                                                                                                                                                                               |
| `GET /api/v1/foods/{foodId:int}/servings`           | –                                                                                                                                  | 200 `FoodServingDto[]`                                                | 404                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `PUT /api/v1/foods/{foodId:int}/servings/{unit}`    | rute `unit`: `ServingUnit`-navn (fx `Milliliter`). Body `UpsertFoodServingRequest { unit, gramsPerUnit }`, hvor rutens unit vinder | 200 `FoodServingDto`                                                  | `gramsPerUnit > 0`, ellers 400 `"GramsPerUnit must be greater than zero."`. Unik på (foodId, unit), og kaldet er en upsert. 403/404                                                                                                                                                                                                                                                                                                                          |
| `DELETE /api/v1/foods/{foodId:int}/servings/{unit}` | –                                                                                                                                  | 204                                                                   | 404 `"Food serving not found."`                                                                                                                                                                                                                                                                                                                                                                                                                              |

```jsonc
// FoodDto
{ "foodId": 12, "name": "Skyr", "barcode": "5701234567890",           // barcode: string | null
  "caloriesPer100": 63.00, "proteinPer100": 11.00, "carbohydratesPer100": 4.00, "fatPer100": 0.20,
  "createdByUserId": 3, "createdAt": "2026-09-30T06:00:00Z",
  "servings": [ { "foodServingId": 5, "unit": "Milliliter", "gramsPerUnit": 1.00 } ] } // sorteret efter unit
// CreateFoodRequest
{ "name": "Skyr", "barcode": "5701234567890", "caloriesPer100": 63, "proteinPer100": 11,
  "carbohydratesPer100": 4, "fatPer100": 0.2 }
// UpdateFoodRequest (alle felter valgfri)
{ "name": "Skyr naturel", "caloriesPer100": 60 }
// UpsertFoodServingRequest
{ "unit": "Milliliter", "gramsPerUnit": 1 }
```

### 2.2 Food logs – `FoodLogsController` (`[Route("api/v1/me/food-logs")]`)

| Verb + rute                                         | Input                                                              | Svar                                | Regler og fejl                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/me/food-logs`                          | query: `from?` (DateTime), `to?` (DateTime), `limit=50`, `cursor?` | 200 `CursorPage<FoodLogDto>`        | Slettede logs er ikke med. `from` er inklusiv og `to` eksklusiv, begge i UTC. Er begge sat, skal `from < to`, ellers 400. Sorteres efter `consumedAt` og derefter `foodLogId`, begge faldende. `limit` er 50 som standard og højst 100. Cursoren er opak (base64url af `ticks:id`).                                                                      |
| `GET /api/v1/me/food-logs/{foodLogId:int}`          | –                                                                  | 200 `FoodLogDto`                    | 404 `"Food log not found."` (også når loggen er slettet)                                                                                                                                                                                                                                                                                                 |
| `POST /api/v1/me/food-logs`                         | `CreateFoodLogRequest`                                             | **201** + `Location` + `FoodLogDto` | `quantity > 0`, ellers 400 `"Quantity must be greater than zero."`. Ukendt `unit` giver 400 `"Quantity unit is invalid."`. En vare, der ikke er brugerens egen, giver 404 `"Food not found."`. Er `unit ≠ Gram`, og varen har ingen serving med den enhed, svarer API'et 400 `"Food {id} has no conversion for {unit}."`. Achievements bliver opdateret. |
| `PATCH /api/v1/me/food-logs/{foodLogId:int}`        | `UpdateFoodLogRequest` (alle felter nullable)                      | 200 `FoodLogDto`                    | Næringsværdierne **genberegnes** ud fra varens aktuelle `per100` og servings. Samme valideringer som ved oprettelse. 404                                                                                                                                                                                                                                 |
| `DELETE /api/v1/me/food-logs/{foodLogId:int}`       | –                                                                  | 204                                 | Blød sletning (`isDeleted`, `deletedAt`). 404, hvis loggen allerede er slettet.                                                                                                                                                                                                                                                                          |
| `POST /api/v1/me/food-logs/{foodLogId:int}/restore` | –                                                                  | **204 uden body**                   | 404 `"Deleted food log not found."`, hvis loggen ikke er slettet                                                                                                                                                                                                                                                                                         |

```jsonc
// CreateFoodLogRequest
{ "foodId": 12, "quantity": 150, "unit": "Gram", "consumedAt": "2026-09-30T06:00:00.000Z" }
// UpdateFoodLogRequest
{ "quantity": 200 }            // foodId?, quantity?, unit?, consumedAt?
// FoodLogDto
{ "foodLogId": 88, "foodId": 12, "foodName": "Skyr", "quantity": 150.00, "unit": "Gram",
  "caloriesConsumed": 94.50, "proteinConsumed": 16.50, "carbohydratesConsumed": 6.00, "fatConsumed": 0.30,
  "consumedAt": "2026-09-30T06:00:00Z" }
// CursorPage<T>
{ "items": [ ... ], "nextCursor": "NjM4OTk...", "hasMore": true }
```

### 2.3 Nutrition (relevant for dagssummer) – `[Route("api/v1/me/nutrition")]`

- `GET today`, `GET days/{date}` (`yyyy-MM-dd`) og `GET days?from=yyyy-MM-dd&to=yyyy-MM-dd` (`to` er eksklusiv, 1–32 dage) giver
  `NutritionDayDto { date, consumed: { calories, protein, carbohydrates, fat }, goal: UserGoalDto | null, remaining: totals | null }`.
  Der kommer én række pr. dag, også for tomme dage (så er summen 0). Dagene afgrænses i **profilens `timeZoneId`**. Uden profil svarer API'et 404 `"Profile not found."`.
- `GET history?from&to&limit&cursor` (from og to er påkrævet) giver `CursorPage<{ foodLog: FoodLogDto, goalAtConsumption }>`.
- Der er **ingen `entryCount`** i `NutritionDayDto`.

### 2.4 Samlinger (kun det, der berører madloggen)

`POST /api/v1/me/meal-collections/{collectionId:int}/log` med body `{ consumedAt, multiplier = 1 }` (`multiplier > 0`) giver **200**
`FoodLogDto[]`. Der oprettes **én log pr. item**, mens appen i dag logger en samling som én samlet vare. Der er heller ingen måltidstype.
Resten af samlingerne hører til samlingsdomænet.

---

## 3. Mapping app ↔ API

### 3.1 Modeller

**`FoodDto` → `FoodItem`** (katalog, søgning og portionsvalg; mapning i servicelaget):

| FoodItem                                             | Fra FoodDto                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                 | `String(foodId)`                                                                                                                                                                                                                                                                                                                                                                              |
| `name`                                               | `name`                                                                                                                                                                                                                                                                                                                                                                                        |
| `brand`                                              | – (findes ikke i API'et, så `undefined`)                                                                                                                                                                                                                                                                                                                                                      |
| `isCustom`                                           | `true`. Alle API-varer er brugerens egne og kan redigeres.                                                                                                                                                                                                                                                                                                                                    |
| `quantity` + `kcal/protein/carbs/fat` (basisportion) | Afledes af servings (appen opretter højst én serving, der ikke er gram, pr. vare): `Serving` giver `"1 portion"`, `Piece` giver `"1 stk"`, `Milliliter` giver `"100 ml"`, og ellers bliver det `"100 g"`. Makroer = `per100 × gramsPerUnit / 100` (for 1 portion/stk), `per100 × gramsPerUnit` (for 100 ml) eller `per100` (100 g). `kcal` afrundes til et heltal og makroerne til 1 decimal. |
| (barcode)                                            | Ligger i det indlæste `FoodDto`-katalog i servicen, fordi `FoodItem` ikke har feltet                                                                                                                                                                                                                                                                                                          |

**`FoodLogDto` → `LoggedFood`:**

| LoggedFood               | Fra FoodLogDto                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `logId`                  | `String(foodLogId)`                                                                                              |
| `id`                     | `String(foodId)`. Det er nok til at logge igen og redigere (`Number(id)`).                                       |
| `name`                   | `foodName`                                                                                                       |
| `quantity`               | `` `${quantity} ${TOKEN[unit]}` ``, fx `"150 g"`, `"250 ml"`, `"2 stk"`, `"1 portion"`                           |
| `kcal/protein/carbs/fat` | `Math.round(caloriesConsumed/proteinConsumed/carbohydratesConsumed/fatConsumed)`, som appens `scaleMacros` i dag |
| `meal`                   | `mealFromConsumedAt(consumedAt)`, midlertidig løsning (§3.3)                                                     |
| `loggedAt`               | `consumedAt`                                                                                                     |
| `isCustom`               | `true`                                                                                                           |
| `brand`                  | –                                                                                                                |

**`FoodItem`/`LoggedFood` → `CreateFoodLogRequest`:** `foodId = Number(id)` (efter en eventuel "ensure food", §4),
`{ amount, unit } = NutritionCalculator.parseQuantity(item.quantity)` giver `quantity = amount` og `unit = QUANTITY_UNIT[unit]`,
og `consumedAt = mealSlotIso(localDay, meal)`.

**`CustomFoodInput` → `CreateFoodRequest` (+ serving):** appens egne varer beskrives pr. portion (`"150 g"`, `"2 stk"`,
`"1 portion"`, `"250 ml"`), mens API'et beskriver dem pr. 100:

| Enhed i `quantity` | `…Per100`                            | Ekstra kald                                                |
| ------------------ | ------------------------------------ | ---------------------------------------------------------- |
| `g` (`amount` g)   | `makro × 100 / amount`               | –                                                          |
| `ml`               | `makro × 100 / amount`               | `PUT …/servings/Milliliter { gramsPerUnit: 1 }`            |
| `stk`              | `makro / amount` (værdi pr. stk)     | `PUT …/servings/Piece { gramsPerUnit: 100 }` (syntetisk)   |
| `portion`          | `makro / amount` (værdi pr. portion) | `PUT …/servings/Serving { gramsPerUnit: 100 }` (syntetisk) |

Værdierne afrundes til 2 decimaler, og `name` trimmes og må højst være 150 tegn. De "syntetiske 100 g" gør regnestykket korrekt
(1 stk = 100 "g" = per100-værdierne), men `caloriesPer100` betyder så i virkeligheden "pr. stk". Det står i gap-listen.

**`ScannedProduct` (OFF) → `CreateFoodRequest`:** `name = item.name` (højst 150 tegn), `barcode`, `…Per100 = item.kcal/protein/carbs/fat`
(de er allerede pr. 100 g/ml). Er `unit === 'ml'`, kaldes også `PUT …/servings/Milliliter { gramsPerUnit: 1 }`.

### 3.2 Enheder (`QuantityUnit`/`ServingUnit` er ens)

| App-token (`quantity`) | API                                      | Oprettes af appen                                                                     |
| ---------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `g`                    | `Gram`                                   | picker og scanner                                                                     |
| `ml`                   | `Milliliter` (kræver en serving)         | scanner (væsker)                                                                      |
| `stk`                  | `Piece` (kræver en serving)              | picker                                                                                |
| `portion`              | `Serving` (kræver en serving)            | picker, "Ukendt vare", opskrift                                                       |
| –                      | `Slice`, `Cup`, `Tablespoon`, `Teaspoon` | Aldrig. Vises med enum-navnet i små bogstaver, hvis en anden klient har oprettet dem. |

### 3.3 Måltid – findes ikke i API'et (blocker, midlertidig løsning)

Appen bruger `MealId = 'morgen' | 'frokost' | 'aften' | 'snack'` til Mad-skærmens grupper
(`FoodLogService.byMeal`), Homes to-do "Log morgenmad" (`home-summary.ts`), undertitlen i historikken og samlingers måltid.
API'et har **intet felt** til det.

**Midlertidig løsning (uden state, ens på tværs af enheder): kod måltidet som et fast lokalt klokkeslæt i `consumedAt`.**

- Konstanter i `core/constants/meals.ts`: `MEAL_SLOT_HOUR = { morgen: 8, frokost: 12, snack: 15, aften: 18 }`.
- Når en vare logges: `consumedAt = new Date(y, m, d, MEAL_SLOT_HOUR[meal]).toISOString()` for den lokale dag.
- Når en log læses: lokal time `< 11` giver morgen, `< 14` frokost, `< 17` snack og ellers aften. Der er bred margin, hvis
  tidszonen skifter på rejser.
- Tidspunktet vises ingen steder i appen (historikken viser kun dag og dato). Den virkelige spisetid går tabt. Til gengæld
  ligger måltiderne midt på dagen, så dagsgrænsen i `nutrition/days` (profilens tidszone) sjældent rammer forkert.
- Markér løsningen som midlertidig i koden med en henvisning til gap #1. Den fjernes, når API'et får `mealType`.

(Alternativet er et lokalt kort fra `foodLogId` til `MealId` i storage. Det bliver ikke delt mellem enheder og går tabt ved
geninstallation, så det er fravalgt.)

### 3.4 Beregning og afrunding

- Serveren gemmer værdier med 2 decimaler. Appen viser heltal. Afrund **pr. log** (`Math.round`) og summér på klienten
  (`sumMacros` som i dag), så summen passer til de viste rækker. Brug ikke `nutrition/days` til Mad-skærmen, for dens summer
  er beregnet ud fra de uafrundede værdier og profilens tidszone.
- Picker og scanner beregner den forventede værdi lokalt (`scaleMacros`). Ved logning bruges **serverens svar** (`FoodLogDto`).
  Afvigelsen er højst ±1 kcal.

---

## 4. Flows: appens handling → API-kald

| App-handling (fil)                                                           | API-kald                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start eller login (`FoodLogService`)                                         | 1) Katalog: `GET /api/v1/foods?limit=100` og derefter `&cursor=nextCursor`, indtil `hasMore=false`. 2) Log: `GET /api/v1/me/food-logs?from=<startOfDay(today−89)>&to=<startOfDay(today+1)>&limit=100` og følg cursoren. Resultatet grupperes i `daysState` efter den lokale dato. Så virker `entries`, `byMeal`, `totals`, `entriesFor`, `dailyTotals` (adaptivt mål og Homes uge) og `allEntries` (historik) uændret.                                                                                    |
| Fokus, `visibilitychange` eller midnat (det eksisterende `refresh`)          | Hent dagens interval igen (`from/to` for i dag) og flet det ind                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Søgning (`FoodSearchService`)                                                | Intet kald. Filtrér det indlæste katalog, som i dag. (`GET /api/v1/foods?query=…&limit=6` kan bruges, hvis kataloget bliver stort.)                                                                                                                                                                                                                                                                                                                                                                       |
| Tjek for dublet-navn (`hasCustomFoodNamed`, picker og scanner)               | Intet kald. Tjek mod kataloget, som svarer til API'ets regel (alle brugerens varer, uden hensyn til store og små bogstaver). 409 fanges som reserve.                                                                                                                                                                                                                                                                                                                                                      |
| Vælg vare og portion, og derefter log (`food-page.onSelected`)               | `POST /api/v1/me/food-logs { foodId, quantity, unit, consumedAt: slot }` → 201 `FoodLogDto` → map og læg i `daysState`                                                                                                                                                                                                                                                                                                                                                                                    |
| Ny egen vare med "Gem" (`addCustomFood`)                                     | `POST /api/v1/foods` og eventuelt `PUT …/servings/{Piece or Serving or Milliliter}`. Kataloget opdateres med svaret. 409 giver `DuplicateCustomFoodNameError`.                                                                                                                                                                                                                                                                                                                                            |
| "Gem og log …"                                                               | Som ovenfor og derefter `POST /me/food-logs`. Pickeren emitter først `customFoodCreated(item)` og så `picked(item)` med samme lokale id `food-xxx`. Servicen gemmer oprettelsen som en ventende `Observable<foodId>` (`shareReplay(1)`), som `add()` venter på.                                                                                                                                                                                                                                           |
| Scan fundet (`food-page.onScanFound`, `item.id = 'off-<barcode>'`)           | Er der en vare med samme `barcode` i kataloget, bruges dens `foodId`. Ellers kaldes `POST /api/v1/foods { name, barcode, per100 }` og for væsker også `PUT …/servings/Milliliter { gramsPerUnit: 1 }`. Til sidst `POST /me/food-logs { quantity: gram eller ml, unit: Gram eller Milliliter }`. `per100` tages fra `ProductLookupService`'s cache ud fra stregkoden (præcis), ikke fra den skalerede og afrundede `FoodItem`. Ved 409 prøves én gang til med navnet `"<navn> (<brand eller stregkode>)"`. |
| Scan-opslag (`BarcodeFlowService.lookup`)                                    | Findes stregkoden i kataloget, returneres den som `found`, og OFF springes over. Ellers bruges OFF som i dag (`ProductLookupService`).                                                                                                                                                                                                                                                                                                                                                                    |
| "Ukendt vare" (`onScanCustomSaved`)                                          | Som "Gem og log". Send gerne også `barcode` med (kræver, at `UnknownProductInput` får en stregkode), så næste scan finder varen.                                                                                                                                                                                                                                                                                                                                                                          |
| Redigér mængde (`food-page.onSelected` i redigeringstilstand)                | `PATCH /api/v1/me/food-logs/{logId} { quantity, unit }` → 200 → erstat i `daysState`. Serveren genberegner værdierne.                                                                                                                                                                                                                                                                                                                                                                                     |
| Redigér egen vares makroer (`onCustomFoodEdited`)                            | `PATCH /api/v1/foods/{id} { …Per100 }` (omregnet efter basisportionen), derefter `PATCH` på loggen som ovenfor. Gamle logs beholder deres værdier, sådan som appen allerede gør.                                                                                                                                                                                                                                                                                                                          |
| Fjern (`food-page.removeEntry`)                                              | `DELETE /api/v1/me/food-logs/{logId}` → 204 → fjern fra `daysState`                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Fortryd fjern (valgfri, findes ikke i UI'et i dag)                           | `POST …/{logId}/restore` → 204, derefter `GET …/{logId}` for at få loggen tilbage                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Log igen fra historikken (`history.relog`)                                   | `POST /me/food-logs` med `foodId = Number(food.id)`, `quantity` og `unit` fra `food.quantity` og `consumedAt` = måltidsslot i dag                                                                                                                                                                                                                                                                                                                                                                         |
| Samlingsfanen i "Tilføj mad" og opskrifter (`food-add-sheet`, `recipe-page`) | Kan ikke udtrykkes som én vare. Når samlinger kommer på API'et (samlingsplanen), bruges `POST /me/meal-collections/{id}/log { consumedAt: slot }`, som giver én log pr. item. Opskrifter er tomme i dag (`recipes = []`).                                                                                                                                                                                                                                                                                 |
| Adaptivt mål og Homes uge                                                    | Intet ekstra kald (de bruger `dailyTotals` fra de indlæste 90 dage). `GET /me/nutrition/days?from&to` kan bruges til optimering senere, men mangler `entryCount`.                                                                                                                                                                                                                                                                                                                                         |

---

## 5. Implementeringsplan (efter ARCHITECTURE.md: API-kald i services, typede DTO'er, mapning i servicelaget, i18n og konstanter)

**Forudsætninger på tværs af domæner (fra auth- og core-planen, bygges ikke her):** base-URL-token, auth-interceptor
(`Authorization: Bearer`), session og logout, der rydder state. Dev: `proxy.conf.json` (`"/api" → http://localhost:5210`) plus
`proxyConfig` i `angular.json`, og `CapacitorHttp: { enabled: true }` i `capacitor.config.ts`. Android-emulatoren bruger
`http://10.0.2.2:5210` (cleartext kun i dev). Profilens `timeZoneId` skal sættes (IANA fra `Intl`), ellers giver nutrition-kald 404.

1. **`core/models/food-api.ts`** (ny): `FoodDto`, `FoodServingDto`, `CreateFoodRequest`, `UpdateFoodRequest`,
   `UpsertFoodServingRequest`, `FoodLogDto`, `CreateFoodLogRequest`, `UpdateFoodLogRequest`, `CursorPage<T>`
   (genbrug den fælles, hvis core-planen laver en), `ApiQuantityUnit` som string union af de 8 navne.
2. **`core/constants/food-api.ts`** (ny): `FOOD_API_PATH = { FOODS: '/api/v1/foods', FOOD_LOGS: '/api/v1/me/food-logs' }`,
   `FOOD_API_PAGE_LIMIT = 100`, `QUANTITY_UNIT_BY_TOKEN` og `TOKEN_BY_QUANTITY_UNIT`, og `SYNTHETIC_GRAMS_PER_UNIT = 100`.
   **`core/constants/meals.ts`**: `MEAL_SLOT_HOUR` og grænserne for tilbagemapningen.
3. **`core/services/food-api/food-api.ts`** (ny, kun HttpClient): `listFoods(cursor?)`, `createFood`, `updateFood`,
   `upsertServing(foodId, unit, gramsPerUnit)`, `listFoodLogs(from, to, cursor?)`, `createFoodLog`, `updateFoodLog`,
   `deleteFoodLog`, `restoreFoodLog`, og en lille hjælper `fetchAll(page$)` med `expand` til cursor-paginering.
4. **`core/services/food-api/food-api-mapping.ts`** (ny, rene funktioner): `toFoodItem(FoodDto)`,
   `toLoggedFood(FoodLogDto)`, `toCreateFoodRequest(CustomFoodInput | ScannedProduct)` med den serving, der skal oprettes,
   `toCreateFoodLogRequest(item, meal, day)`, `mealSlotIso` og `mealFromConsumedAt`.
5. **`core/services/food-log/food-log.ts`**: kildedata kommer fra API'et i stedet for `StorageService`
   (`STORAGE_KEY.FOOD_LOG` og `CUSTOM_FOODS` bruges ikke længere). Lokale data fra før API'et **migreres ikke** (YAGNI), medmindre
   der er rigtige brugere med data. `load()` køres ved login. `add`, `update`, `remove`, `addCustomFood` og `updateCustomFood`
   returnerer nu `Observable` og opdaterer signalerne ud fra svaret (pessimistisk, så der ikke skal laves rollback). `loading`
   og `error` gøres tilgængelige som signaler. `customFoods` = `computed(katalog.map(toFoodItem))`. `findByBarcode(code)`.
   Alle beregnede signaler beholdes uændret.
6. **`core/services/product-lookup/product-lookup.ts`**: læseadgang `cached(barcode): ScannedProduct | null` til "ensure food".
   **`barcode-flow.ts`**: tjek kataloget først i `lookup()`. `toCustomFood` tager `barcode` med.
7. **Kaldere, der nu er asynkrone:** `features/food/pages/food-page/food-page.ts` (subscribe, en `pending`-state, der
   deaktiverer CTA'en, og fejlnotits via `UiFormError` med nye i18n-nøgler som `food.page.saveError`, `food.page.removeError` og
   `food.page.loadError`), `features/history/services/history.ts` (relog), `features/collections/components/new-collection-sheet`
   (`addCustomFood`). `food-search.ts` er uændret og filtrerer stadig kataloget. `FOOD_SEARCH_DELAY_MS` kan fjernes.
8. **i18n**: nye nøgler i `src/i18n/da.json` og `en.json`. Ingen backend-tekst vises direkte for brugeren.
9. **README'er**: `core/services/README.md` (FoodApi og FoodLogService), `core/models/README.md`, `core/constants/README.md`,
   `features/food/README.md` (asynkron log og fejl-state). Den midlertidige måltidsløsning dokumenteres som en bevidst genvej.
10. **Tests (vitest og `provideHttpClientTesting`)**:
    - `food-api-mapping.spec.ts`: basisportion pr. serving-variant, rundtur for enheds-tokens, afrunding, per100-omregning for
      g, ml, stk og portion, `mealSlotIso` og `mealFromConsumedAt` tur-retur for alle fire måltider og omkring sommertid.
    - `food-api.spec.ts`: præcise URL'er, parametre og bodies (`from` og `to` som `toISOString()`, `limit=100`, enum-navne).
    - `food-log.spec.ts` (omskrives): load med to sider (`nextCursor`), add (body), scan med stregkode i kataloget (ingen
      `POST /foods`), scan af et nyt produkt (`POST /foods`, `PUT servings/Milliliter` og `POST log` i rækkefølge),
      "Gem og log" (loggen venter på oprettelsen), 409 giver `DuplicateCustomFoodNameError`, remove giver DELETE og en opdateret
      signal-state, fejl giver `error`-state og uændret state.
    - `food-page.spec.ts`: fejlnotits og deaktiveret CTA, mens kaldet kører.
    - **UI-test** mod dev-containeren (`:5210`) via `npm start` med proxy i browser-panelet: log ind med en testbruger fra
      projektets seed, gå til Mad, tilføj en vare, genindlæs (varen er der stadig), redigér mængden, fjern varen, og indtast en
      stregkode manuelt (browseren kan ikke scanne) af et OFF-produkt, som derefter logges og findes igen uden OFF.

---

## 6. Gaps til API-teamet (se også det strukturerede output)

1. **[BLOCKER] Måltidstype på madlog.** Der mangler `mealType` på `FoodLog`, `CreateFoodLogRequest` (påkrævet),
   `UpdateFoodLogRequest` (valgfri), `FoodLogDto` og `LogMealCollectionRequest`. Forslag:
   `enum MealType { Breakfast = 1, Lunch = 2, Dinner = 3, Snack = 4 }` (JSON `"Breakfast"` …), med i `/api/v1/metadata`
   som `mealTypes`, og eventuelt som filter på `GET /me/food-logs`.
2. **[MAJOR] CORS.** Der er ingen CORS-policy, så `ng serve` (`http://localhost:4200`) og Capacitor-WebView'et
   (`capacitor://localhost`, `https://localhost`, `http://localhost`) bliver blokeret. Tillad `Authorization` og
   `Content-Type`, `GET/POST/PATCH/PUT/DELETE`.
3. **[MAJOR] Ingen delt fødevaredatabase.** `GET /api/v1/foods` finder kun brugerens egne varer, og `createdByMe` bruges ikke.
   Forslag: offentlige varer (system eller importerede) i søgningen, `createdByMe=true` som filter og sortering efter relevans.
4. **[MAJOR] Ingen stregkodeopslag på serveren ud over egne varer.** Hver bruger må selv kalde Open Food Facts og gemme sin egen
   kopi. Forslag: `GET /api/v1/foods/barcode/{code}`, der slår op i delte varer eller OFF og returnerer `FoodDto` (eventuelt med import).
5. **[MAJOR] Kravet om unikt navn blokerer import.** 409 ved to forskellige produkter med samme navn. Der er intet `brand`, og
   stregkoder dedupes ikke. Forslag: unikhed på (userId, barcode), tillad samme navn med forskellig stregkode og returnér
   `existingFoodId` i 409, som ved vægt-konflikten.
6. **[MAJOR] Næring kun pr. 100 g.** En vare kan ikke defineres pr. stk eller portion (appens "1 portion = 450 kcal").
   Den midlertidige løsning er en syntetisk serving på 100 g, hvilket giver misvisende data. Forslag: `nutritionBasis`
   (`Per100Gram`, `Per100Milliliter` eller `PerServing`) eller næring pr. standardportion.
7. **[MINOR] Væsker.** Logning i `Milliliter` kræver en `Milliliter`-serving pr. vare (et ekstra `PUT`). Forslag: `baseUnit` på Food,
   eller ml = g 1:1 for varer pr. 100 ml.
8. **[MINOR] `CreateFoodRequest` kan ikke indeholde `servings`**, så det kræver 2–4 kald at oprette og logge en vare. Forslag:
   `servings[]` ved oprettelse, eller et kombineret endpoint.
9. **[MINOR] Intet `brand`-felt** på Food (appen viser brand fra OFF).
10. **[MINOR] Ingen `source` eller `isCustom`**, der skelner egne varer fra importerede produkter.
11. **[MINOR] Varer kan aldrig slettes, når de først er logget** (409, også når kun soft-deleted logs peger på dem), og de kan ikke
    arkiveres. Kataloget vokser med hvert scannet produkt. Forslag: `isArchived` eller soft delete.
12. **[MINOR] Ingen `date`-filter på food-logs.** Klienten må selv regne et UTC-interval, mens nutrition bruger profilens tidszone.
    Forslag: `GET /me/food-logs?date=YYYY-MM-DD` i profilens tidszone.
13. **[MINOR] `NutritionDayDto` mangler `entryCount`** (appen skelner mellem en dag uden log og en dag med 0 kcal).
14. **[MINOR] `POST …/restore` returnerer 204 uden body.** Forslag: 200 med `FoodLogDto`.
15. **[MINOR] Huller i valideringen.** `consumedAt` er ikke påkrævet (mangler den, accepteres 0001-01-01). Der er ingen øvre
    grænse for `quantity`, så et overløb i `numeric(7,2)` giver 500 i stedet for 400.
16. **[MINOR] Fejlformaterne er forskellige** (ProblemDetails, ValidationProblemDetails og 401 uden body), og der er ingen
    maskinlæsbar `code` (fx `food.duplicateName`).
17. **[MINOR] Søgningen sorterer efter nyeste id**, ikke efter relevans, og der er intet endpoint til "seneste og hyppige varer".
18. **[MINOR] En samling logges som én log pr. item**, mens appen logger en samling som én samlet vare. Beslutningen hører til
    samlingsdomænet.
