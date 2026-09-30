# Samlinger / opskrifter: app ↔ API-mapning

Domæne: måltidssamlinger ("Samling"-fanen, opskriftsskærmen, "Ny/Rediger samling"-arket,
"Samlinger"-fanen i "Tilføj mad"-arket).

Kilder, der er læst:

- App: `src/app/core/services/collections/collections.ts`, `core/models/food.ts`,
  `core/models/meal.ts`, `core/constants/collection-icons.ts`, `core/constants/meals.ts`,
  `features/collections/**`, `features/food/components/food-add-sheet/food-add-sheet.ts`
  (logger en hel samling), `features/profile/services/achievements.ts` (tæller
  `userCollections()`), `core/services/food-log/food-log.ts`,
  `shared/components/food-picker/food-picker.ts`, `core/services/barcode-flow/barcode-flow.ts`.
- API: `Controllers/MealCollectionsController.cs`, `DTOs/Meals/*`,
  `Services/Meals/MealCollectionService.cs`, `Domain/Entities/MealCollection.cs`,
  `MealItem.cs`, `Food.cs`, `FoodServing.cs`, `FoodLog.cs`,
  `Services/FoodLogs/FoodNutritionCalculator.cs`, `FoodLogService.cs`, `FoodService.cs`,
  `Data/FitnessAppDbContext.cs`, `Program.cs`, `Exceptions/GlobalExceptionHandler.cs`,
  `Utilities/RequestGuards.cs`, `CursorCodec.cs`, `EnumMappings.cs`.
- Tjekket mod den kørende docker-API (`fitnessapp-dev-api-1`, `http://localhost:5210`):
  `/swagger/v1/swagger.json` bekræfter camelCase-navne og enums som strenge, og
  `OPTIONS /api/v1/me/meal-collections` med `Origin: http://localhost:4200` giver
  `405 Method Not Allowed`, så der er ingen CORS.

---

## 1. Serialisering (gælder alle kald)

- **JSON-navne:** ASP.NET's standard, altså camelCase. `Program.cs` sætter ingen
  `PropertyNamingPolicy`, og deserialisering er case-insensitive.
- **Enums:** `JsonStringEnumConverter()` uden naming policy. Værdierne skrives i PascalCase
  (`"Gram"`, `"Milliliter"`, `"Piece"`, `"Slice"`, `"Cup"`, `"Tablespoon"`, `"Teaspoon"`,
  `"Serving"`). Ved indlæsning accepteres navnene uden hensyn til store/små bogstaver, og
  heltal (1–8) accepteres også. Appen sender altid PascalCase-navnet.
  `GET /api/v1/metadata` (anonym) returnerer også `quantityUnits`.
- **Decimaler:** `decimal` kommer som JSON-tal (f.eks. `523.45`). I databasen er
  `MealItem.Quantity` `numeric(9,2)`, så mængder afrundes til 2 decimaler.
- **Tider:** `createdAt`/`consumedAt` er ISO-8601. Serveren gemmer UTC
  (`timestamp with time zone`). En `consumedAt` uden zone tolkes som UTC
  (`RequestGuards.NormalizeUtc`), så appen skal sende `new Date().toISOString()` (med `Z`).
- **Auth:** alle endpoints kræver `[Authorize]` med Bearer-JWT (`token_type=access`), og
  brugeren skal være aktiv, e-mailverificeret og ikke slettet. Uden token svarer API'et
  `401` med tom body og `WWW-Authenticate: Bearer`.
- **Fejl:**
  - `NotFoundException` → `404`, ProblemDetails `{status, title:"Resource not found", detail}`.
  - `BusinessValidationException` → `400`, `{title:"Validation failed", detail:"…"}`.
  - DataAnnotations-fejl (`[Required]`, `[MaxLength]`) og JSON-parsefejl → `400`
    ValidationProblemDetails `{title:"One or more validation errors occurred.", errors:{…}}`
    via `[ApiController]`. Nøglerne er f.eks. `Name` eller `$.items[0].unit`.
  - `ConflictException` → `409`. Samlinger kaster den aldrig, men `DELETE /api/v1/foods/{id}`
    gør, hvis varen bruges i en samling.
- **CORS:** er ikke konfigureret, hverken med `AddCors` eller `UseCors`. Se gap G10.

## 2. Endpoints (`MealCollectionsController`, route `api/v1/me/meal-collections`)

| #   | Verb + route                                                       | Request                                                                      | Svar                                                                                                                 | Regler og fejl                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `GET /api/v1/me/meal-collections?limit=30&cursor=`                 | –                                                                            | `200` `CursorPage<MealCollectionDto>` = `{ items: MealCollectionDto[], nextCursor: string\|null, hasMore: boolean }` | `limit` ≤ 0 → 30, maks. 100. Sorteres nyeste først (`createdAt desc, mealCollectionId desc`). En ugyldig `cursor` → 400 "The cursor is invalid." Kun egne samlinger.                                                                                                                                                                                                                                                                        |
| E2  | `GET /api/v1/me/meal-collections/{collectionId:int}`               | –                                                                            | `200` `MealCollectionDto`                                                                                            | 404 "Meal collection not found." (også ved en andens samling)                                                                                                                                                                                                                                                                                                                                                                               |
| E3  | `POST /api/v1/me/meal-collections`                                 | `CreateMealCollectionRequest`                                                | `201` `MealCollectionDto` + `Location`                                                                               | `name` påkrævet, ikke blank, maks. 100 (trimmes). `items` påkrævet, **1–50** stk. Hver `foodId` > 0 og **skal være brugerens egen vare** (`Food.CreatedByUserId == userId`), ellers 404 "One or more foods were not found." `quantity` > 0. `unit` defineret og **omregnelig**: alt andet end `Gram` kræver en `FoodServing` med samme enhed på varen, ellers 400 "Food {id} has no conversion for {unit}." Navne behøver ikke være unikke. |
| E4  | `PATCH /api/v1/me/meal-collections/{collectionId}`                 | `UpdateMealCollectionRequest` `{ name }`                                     | `200` `MealCollectionDto`                                                                                            | **Kun navn.** `name` påkrævet, maks. 100. 404 ved ukendt id.                                                                                                                                                                                                                                                                                                                                                                                |
| E5  | `DELETE /api/v1/me/meal-collections/{collectionId}`                | –                                                                            | `204`                                                                                                                | Varerne slettes med (cascade). Madlog påvirkes ikke. 404.                                                                                                                                                                                                                                                                                                                                                                                   |
| E6  | `POST /api/v1/me/meal-collections/{collectionId}/items`            | `CreateMealItemRequest` `{ foodId, quantity, unit }`                         | `201` `MealItemDto` (uden `Location`)                                                                                | Samme varevalidering som E3. 404 "Meal collection not found." / "Food not found." **Returnerer ikke nye totaler.**                                                                                                                                                                                                                                                                                                                          |
| E7  | `PATCH /api/v1/me/meal-collections/{collectionId}/items/{itemId}`  | `UpdateMealItemRequest` `{ foodId?, quantity?, unit? }` (null = uændret)     | `200` `MealItemDto`                                                                                                  | 404 "Meal item not found." Samme validering af de flettede værdier.                                                                                                                                                                                                                                                                                                                                                                         |
| E8  | `DELETE /api/v1/me/meal-collections/{collectionId}/items/{itemId}` | –                                                                            | `204`                                                                                                                | **400 "A meal collection must contain at least one item."**, hvis det er den sidste vare. 404.                                                                                                                                                                                                                                                                                                                                              |
| E9  | `POST /api/v1/me/meal-collections/{collectionId}/log`              | `LogMealCollectionRequest` `{ consumedAt: string, multiplier?: number = 1 }` | `200` `FoodLogDto[]`                                                                                                 | `multiplier` > 0. Opretter **én `FoodLog` pr. vare** (`quantity × multiplier`, samme `unit`, samme `consumedAt`) i én transaktion og opdaterer achievements. Loggene har ingen reference tilbage til samlingen. 404.                                                                                                                                                                                                                        |

### DTO-former (JSON)

```ts
// MealCollectionDto
{ mealCollectionId: number; name: string; createdAt: string;
  items: MealItemDto[];                     // sorteret efter mealItemId
  totals: { calories: number; protein: number; carbohydrates: number; fat: number } }
// MealItemDto
{ mealItemId: number; foodId: number; foodName: string; quantity: number; unit: QuantityUnit }
// CreateMealCollectionRequest
{ name: string; items: { foodId: number; quantity: number; unit: QuantityUnit }[] }
// UpdateMealItemRequest
{ foodId?: number | null; quantity?: number | null; unit?: QuantityUnit | null }
// LogMealCollectionRequest
{ consumedAt: string; multiplier?: number }
// FoodLogDto (svaret fra E9)
{ foodLogId: number; foodId: number; foodName: string; quantity: number; unit: QuantityUnit;
  caloriesConsumed: number; proteinConsumed: number; carbohydratesConsumed: number;
  fatConsumed: number; consumedAt: string }
type QuantityUnit = 'Gram' | 'Milliliter' | 'Piece' | 'Slice' | 'Cup' | 'Tablespoon' | 'Teaspoon' | 'Serving';
```

**Sådan regnes totalerne (`MealCollectionService.ToDto`):** For hver vare regnes
`FoodNutritionCalculator.Calculate(food, quantity, unit)`: gram = `quantity` for `Gram`,
ellers `quantity × FoodServing.GramsPerUnit`. Derefter `per100 × gram/100`, afrundet til
2 decimaler pr. vare, og til sidst summeres. Totalerne regnes **live ud fra varens aktuelle
næringsværdier**. Retter brugeren en egen vare, ændres samlingens totaler med tilbagevirkende
kraft. I dag gemmer appen et snapshot.

## 3. Feltmapning

### `FoodCollection` (app) ↔ `MealCollectionDto` (API)

| App-felt                                                                       | API                        | Mapning / status                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id: string`                                                                   | `mealCollectionId: number` | `String(mealCollectionId)`. Ruten bliver `col:<mealCollectionId>` (`BUNDLE_ID_PREFIX`), og kolon-formatet er uændret.                                                                                                                                                                                                                                        |
| `name: string`                                                                 | `name`                     | 1:1. Maks. 100 tegn (app-inputtet skal have `maxlength=100`). Appens entydighedstjek (trimmet, uden hensyn til store/små bogstaver) kører videre på klienten mod den hentede liste. API'et håndhæver det ikke (G8).                                                                                                                                          |
| `icon: CollectionIconName`                                                     | **findes ikke**            | Gap G1. Indtil videre gemmes det i et lokalt sidebord pr. `mealCollectionId`. Standard er `'star'`.                                                                                                                                                                                                                                                          |
| `meal: MealId` (`morgen`/`frokost`/`aften`/`snack`)                            | **findes ikke**            | Gap G1. Samme sidebord. Standard er `'morgen'`. Styrer tone, filter og det måltid, "Log som spist under" starter på.                                                                                                                                                                                                                                         |
| `isBase: boolean`                                                              | **findes ikke**            | Altid `false`. Der er ingen system-samlinger (G9).                                                                                                                                                                                                                                                                                                           |
| `recipeIds: string[]`                                                          | **findes ikke**            | Altid `[]` (G9).                                                                                                                                                                                                                                                                                                                                             |
| `items: FoodItem[]`                                                            | `items: MealItemDto[]`     | Se tabellen nedenfor.                                                                                                                                                                                                                                                                                                                                        |
| `CollectionsService.collectionTotals()` → `{kcal, protein, carbs, fat, count}` | `totals`                   | `kcal ← totals.calories`, `protein ← totals.protein`, `carbs ← totals.carbohydrates`, `fat ← totals.fat`, `count ← items.length`. Brug **API'ets** totaler i stedet for at summere i appen. Afrund i visningen (`Math.round`): i dag viser `recipe-page.html` (`'collections.recipePage.log' {kcal}`) og `food-add-sheet.ts` (`kcalLabel`) `kcal` uafrundet. |
| –                                                                              | `createdAt`                | Bruges ikke. Listen kommer nyeste først, mens appen i dag viser i oprettelsesrækkefølge. Vend den på klienten eller accepter den nye rækkefølge.                                                                                                                                                                                                             |

### Samlingsvare (`FoodItem` i `collection.items`) ↔ `MealItemDto`

| App-felt                              | API                                       | Mapning / status                                                                                                                                                                                                                                                                |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id: string`                          | `mealItemId`                              | `String(mealItemId)` for gemte varer. Varer, der kun findes i kladden, beholder `newId('item')`, som er ikke-numerisk. Diff-logikken kender dem på, at id'et ikke findes blandt de gemte.                                                                                       |
| _(mangler i modellen)_                | `foodId`                                  | **Nyt felt i appen:** `foodId: number`. `putInDraft()` overskriver i dag `id` og mister dermed referencen til varen. Den skal sætte `foodId` ud fra den valgte vares server-id, før `id` overskrives.                                                                           |
| `name`                                | `foodName`                                | 1:1, skrivebeskyttet. Navnet kommer fra varen.                                                                                                                                                                                                                                  |
| `quantity: string` (f.eks. `'250 g'`) | `quantity: number` + `unit: QuantityUnit` | Frem mod API'et: `NutritionCalculator.parseQuantity()` → `{amount, unit}` og derefter enhedstabellen nedenfor. Tilbage i appen: `${formatAmount(quantity)} ${label(unit)}`.                                                                                                     |
| `kcal/protein/carbs/fat` pr. vare     | **findes ikke pr. vare**                  | Gap G4. Kladdearket viser `item.kcal` pr. række. Midlertidigt: regn det i appen med samme formel som `FoodNutritionCalculator` ud fra brugerens varekatalog (`GET /api/v1/foods?createdByMe=true`, `FoodDto.caloriesPer100…` + `servings[]`), som varedomænet alligevel henter. |
| `brand?`, `isCustom?`                 | –                                         | Ignoreres. Alle API-varer er brugerens egne.                                                                                                                                                                                                                                    |

### Enheder (app-streng ↔ `QuantityUnit`)

| App (`parseQuantity().unit`)                      | API                                      | Krav på varen                                                                                         |
| ------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `g`                                               | `Gram`                                   | intet                                                                                                 |
| `ml` (scannede væsker, base `100 ml`)             | `Milliliter`                             | `FoodServing` med `Milliliter` (`PUT /api/v1/foods/{id}/servings/Milliliter {gramsPerUnit}`)          |
| `stk`                                             | `Piece`                                  | `FoodServing` med `Piece`                                                                             |
| `portion` (inkl. `'1 portion'` fra "Ukendt vare") | `Serving`                                | `FoodServing` med `Serving`                                                                           |
| anden fritekst (fra "Ukendt vare"-formularen)     | fallback `Serving`                       | som ovenfor                                                                                           |
| –                                                 | `Slice`, `Cup`, `Tablespoon`, `Teaspoon` | Appen sender dem aldrig, men skal kunne vise dem (nye i18n-nøgler, f.eks. `core.quantityUnit.slice`…) |

Afhængighed til varedomænet: API'ets `Food` har næringsværdier **pr. 100 g**. En egen vare
defineret som "1 portion = 450 kcal" skal derfor oprettes som `Food` (`POST /api/v1/foods`)
med en serving-konvertering, før den kan lægges i en samling. Det løser vare-mapningen.
Samlinger forudsætter blot, at hver kladdevare har et server-`foodId`. Det samme gælder
scannede produkter: i dag lægger `onScanned()` dem direkte i kladden uden at gemme dem som
egen vare. Mod API'et skal de først slås op (`GET /api/v1/foods?barcode=`) eller oprettes
(`POST /api/v1/foods`, 409 ved navnekollision).

## 4. CRUD-semantik: app → API

| App-handling                                                                                                 | I dag (lokalt)                                                                                              | Mod API'et                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hent liste (`collections` signal)                                                                            | `localStorage` `nutrify.collections`                                                                        | E1 i løkke med `limit=100` og `cursor=nextCursor`, indtil `hasMore=false`. Map hver `MealCollectionDto`.                                                                                                                                                                                                                                                                                                                            |
| Opret (`CollectionsPage.onCreated` → `create()`)                                                             | synkron, 0..n varer tilladt                                                                                 | E3 `{ name, items:[{foodId, quantity, unit}] }`. **Kladden skal have 1–50 varer**, så submit-knappen i arket skal være deaktiveret ved 0 varer (G7). `icon`+`meal` gemmes i sidebordet under det returnerede `mealCollectionId`.                                                                                                                                                                                                    |
| Rediger (`RecipePage.onUpdated` → `update(id, input)`), der erstatter navn, ikon, måltid og varer            | én skrivning                                                                                                | Diff, udført **sekventielt** (G5): (1) E4 `PATCH {name}`, hvis navnet er ændret; (2) E6 for hver ny kladdevare; (3) E7 for hver gemt vare med ændret `foodId`/`quantity`/`unit`; (4) E8 for hver fjernet vare, **efter** tilføjelserne, så "mindst én vare" aldrig brydes; (5) E2 for friske totaler og varenavne; (6) opdater ikon/måltid i sidebordet. Ikke atomisk: fejler et trin, hentes samlingen igen (E2), og fejlen vises. |
| Slet (`RecipePage.delete` → `remove()`)                                                                      | synkron                                                                                                     | E5 → `204`. Fjern samlingen fra state og sidebord.                                                                                                                                                                                                                                                                                                                                                                                  |
| Log hele samlingen (`RecipePage.log()` og `FoodAddSheet.onCollectionPicked`)                                 | **én** `LoggedFood` `{id:'col:…', name, quantity:'1 portion', summerede makroer}` under det valgte `MealId` | E9 `{ consumedAt: now().toISOString(), multiplier: 1 }` → `FoodLogDto[]` med **én post pr. vare**. Svaret gives videre til madlog-servicen (madlogdomænet mapper `FoodLogDto`). **Det valgte måltid kan ikke gemmes** (G2), og loggen vises som N linjer i stedet for én (G3). Begge steder skal kalde samme `CollectionsService.log(id, meal)` i stedet for at bygge et kombineret `FoodItem`.                                     |
| Log én løs vare (rute-id `<vareId>`, `itemDetail`)                                                           | `foodLog.add(item)`                                                                                         | `POST /api/v1/me/food-logs { foodId, quantity, unit, consumedAt }` (madlogdomænet). Rute-id'et er `String(mealItemId)`, og vare og `foodId` slås op i de indlæste samlinger.                                                                                                                                                                                                                                                        |
| Retter (`recipes`, `recipeById`, `collectionForRecipe`) og faste samlinger (`baseCollections`, filter-chips) | tomme                                                                                                       | Stadig tomme, fordi der ikke er noget endpoint (G9). Ingen kodeændring ud over at beholde `[]`.                                                                                                                                                                                                                                                                                                                                     |
| Achievement "egen samling"                                                                                   | `userCollections().length > 0`                                                                              | Uændret, men signalet er fyldt fra API'et. Achievements-domænet kan også bruge serverens egne achievements.                                                                                                                                                                                                                                                                                                                         |

## 5. Implementeringsplan (minimal, efter ponytail)

Forudsætninger fra andre domæner (auth/foods/food-logs), som ikke laves her:
API-base-URL (`InjectionToken`), et auth-interceptor med Bearer-token, en dev-proxy
(`proxy.conf.json`: `/api` → `http://localhost:5210`) plus `CapacitorHttp` på native (på grund
af den manglende CORS, G10), og at egne varer har server-`foodId`.

1. **API-typer:** `core/models/meal-collection-api.ts` med `MealCollectionDto`, `MealItemDto`,
   `NutritionTotalsDto`, `CursorPage<T>`, `CreateMealCollectionRequest`, `CreateMealItemRequest`,
   `UpdateMealItemRequest`, `LogMealCollectionRequest`, `QuantityUnit`. `FoodLogDto` genbruges
   fra madlogdomænet, hvis det findes.
2. **HTTP-service:** `core/services/meal-collections-api/meal-collections-api.ts`, tynd og
   uden logik: `list(cursor?)`, `get(id)`, `create(req)`, `rename(id, name)`, `remove(id)`,
   `addItem(id, req)`, `updateItem(id, itemId, req)`, `removeItem(id, itemId)`,
   `log(id, req)`. Stierne samles i en konstant (`MEAL_COLLECTIONS_ENDPOINT`), fordi magic
   strings ikke er tilladt.
3. **Enhedsmapning:** en lille ren funktion i `core/utils/quantity-unit.ts` med
   `toQuantityUnit(appUnit)` og `quantityUnitLabelKey(unit)` efter tabellen i afsnit 3.
4. **`CollectionsService`:** beholder sin offentlige signal-overflade (`collections`,
   `userCollections`, `baseCollections` = `[]`, `recipes` = `[]`, `collectionById`,
   `isNameTaken`, `itemById`, `collectionTotals`).
   - Ny `status` signal (`'idle' | 'loading' | 'ready' | 'error'`) og `load()`, der pagerer
     E1 til ende.
   - `create`/`update`/`remove`/`log` returnerer `Observable` (eller `Promise`) og opdaterer
     state ud fra serverens svar. Fejl oversættes til `ApiError` uden tavse catch.
   - `collectionTotals()` læser API'ets `totals` (gemt på modellen), i stedet for at summere.
   - Sidebord for ikon/måltid: `STORAGE_KEY.COLLECTION_META` (`nutrify.collection-meta`) =
     `Record<mealCollectionId, {icon, meal}>`, markeret med en `// ponytail:`-kommentar
     (fjernes, når G1 er lukket). `nutrify.collections` bruges ikke mere.
   - Modellen: `FoodCollection.items: readonly CollectionItem[]`, hvor
     `CollectionItem = FoodItem & { foodId: number }`. `totals: Macros` lægges på
     `FoodCollection`.
5. **Komponenter** (kun det nødvendige):
   - `CollectionsPage`: kalder `load()` ved åbning og viser loading/error/empty
     (`ui-spinner`, `ui-empty-state` med "Prøv igen"). `onCreated` venter på svaret, lukker
     arket ved succes og viser fejl ved 400.
   - `NewCollectionSheet`: `canSave` kræver også `1 ≤ draft.length ≤ 50`. Navnet får
     `maxlength=100`. `putInDraft` sætter `foodId`. En ny i18n-tekst forklarer, at mindst
     én vare er påkrævet (da/en).
   - `RecipePage`: `onUpdated`/`delete`/`log` er asynkrone med en busy-state på knappen og
     viser fejl. Log-knappens kcal afrundes. Logning navigerer til `/mad` ved succes.
   - `CollectionsViewService`: `bundleEntry`/`bundleDetail` bruger `collection.totals` i stedet
     for `sumMacros(items)`. Ellers uændret.
   - `FoodAddSheet` ("Samlinger"-fanen): logning går gennem `CollectionsService.log()`, og
     `kcalLabel` afrundes.
6. **README'er:** opdater `core/services/README.md` (collections + ny api-service),
   `features/collections/README.md` ("Beslutninger": server er kilden, sidebord for
   ikon/måltid, mindst én vare, log = én post pr. vare) og `food-add-sheet/README.md`.

### Test

- `meal-collections-api.spec.ts` med `provideHttpClientTesting()`: verb, URL og body for hvert
  endpoint (enum som `"Gram"`, `consumedAt` som ISO med `Z`, `multiplier: 1`) og `204` på
  delete.
- `collections.spec.ts` (omskrives):
  - DTO → `FoodCollection`: id'er som strenge, `quantity`-label, totaler → makroer og
    standardværdier for ikon/måltid.
  - `load()` pagerer over 2 sider.
  - `create` sender den rigtige body og gemmer meta.
  - `update`-diff kalder i rækkefølgen PATCH navn → POST nye → PATCH ændrede → DELETE
    fjernede → GET.
  - En 400/404 ProblemDetails bliver til `ApiError`.
  - `log()` sender det rigtige body.
- Komponent-specs: kladdearket deaktiverer "Opret" ved 0 varer. Collections-siden viser
  loading-, error- og empty-state. Opskriftssiden afrunder kcal og logger via servicen.
  `food-add-sheet.spec.ts` rettes til, så den logger via servicen.
- UI-test i Browser-panelet: `npm start` med dev-proxy mod docker-API'et (`localhost:5210`).
  Opret, omdøb, tilføj og fjern vare, slet, og log samling. Tjek resultatet i netværksloggen.
  Det kræver en verificeret testbruger (auth-domænet; der er ingen SMTP i docker, så
  `EmailVerifiedAt` skal sættes i dev-databasen på port 5433).

---

## 6. Gaps til API-teamet

- **G1 (major) – Samlingen mangler ikon og måltid.** `MealCollection` og `MealCollectionDto`
  har kun `name`. Appen har også `icon` (en af 30 faste navne, f.eks. `"egg"`, `"salad"`)
  og `meal` (morgenmad/frokost/aftensmad/snack), der styrer farve, filter og det måltid, der
  logges under. Forslag: `icon: string` (maks. 30) og `mealType: MealType`
  (`Breakfast|Lunch|Dinner|Snack`) på entity, `MealCollectionDto`,
  `CreateMealCollectionRequest` og `UpdateMealCollectionRequest` (PATCH med valgfri felter).
  Indtil da gemmer appen dem lokalt, så de går tabt ved geninstallation og på andre enheder.
- **G2 (blocker) – Logning kan ikke placeres under et måltid.**
  `LogMealCollectionRequest(consumedAt, multiplier)` og `FoodLog`/`FoodLogDto`/
  `CreateFoodLogRequest` har intet måltidsfelt. "Log som spist under [måltid]" kan derfor
  ikke gemmes, og madloggen i appen er grupperet pr. måltid. Forslag: `mealType: MealType` på
  `LogMealCollectionRequest`, `CreateFoodLogRequest`, `UpdateFoodLogRequest` og `FoodLogDto`
  (samme enum som i G1). Madlogdomænet har samme behov.
- **G3 (major) – En logget samling kan ikke grupperes.** `POST …/{id}/log` opretter N
  uafhængige `FoodLog`-rækker uden reference til samlingen. Appen viser i dag en logget
  samling som én linje ("Morgenmadsbowl · 1 portion") og kan fjerne den igen samlet.
  Forslag: nullable `mealCollectionId` (og evt. `logGroupId: Guid`) på `FoodLog`/`FoodLogDto`
  og et endpoint, der sletter en hel gruppe
  (`DELETE /api/v1/me/food-logs?groupId=` eller `DELETE /api/v1/me/food-log-groups/{id}`).
- **G4 (major) – Ingen næringsværdier pr. vare.** `MealItemDto` har kun `foodId`, `foodName`,
  `quantity` og `unit`, men appen viser kcal pr. vare i redigeringsarket. Tallet regnes
  allerede i `ToDto`. Forslag: `nutrition: NutritionTotalsDto` (`calories`, `protein`,
  `carbohydrates`, `fat`) på `MealItemDto`, også i svarene fra `POST`/`PATCH …/items`.
- **G5 (major) – Navn og varer kan ikke gemmes samlet og atomisk.** `PATCH
/{id}` tager kun `name`. Varer kræver et kald pr. vare (`POST`/`PATCH`/`DELETE …/items`)
  uden fælles transaktion, så en fejl midtvejs efterlader en halvt opdateret samling.
  Forslag: `PUT /api/v1/me/meal-collections/{id}` med
  `{ name, icon?, mealType?, items: [{ mealItemId?, foodId, quantity, unit }] }`, der
  erstatter varelisten i én transaktion og returnerer `MealCollectionDto`.
- **G6 (minor) – Vare-endpoints returnerer ikke samlingen.** `POST`/`PATCH …/items`
  returnerer `MealItemDto` uden de nye `totals`, så appen skal lave et ekstra
  `GET /{id}`. Forslag: returnér hele `MealCollectionDto`. Bliver overflødigt, hvis G5
  laves.
- **G7 (minor) – Tomme samlinger.** API'et kræver 1–50 varer ved oprettelse og nægter at
  slette den sidste vare (400). Appen tillader i dag en samling med kun et navn. Appen
  tilpasses til "mindst én vare". Bekræft, at det er den ønskede produktregel. Ellers skal
  0 varer tillades i `CreateAsync` og `DeleteItemAsync`.
- **G8 (minor) – Navne er ikke unikke.** Appen kræver unikke samlingsnavne (trimmet, uden
  hensyn til store/små bogstaver), men API'et accepterer dubletter. Forslag: `409 Conflict`
  i `CreateAsync`/`UpdateAsync`, som for varer (`FoodService.CreateAsync`).
- **G9 (major) – Ingen faste samlinger og ingen retter.** Appens model har faste
  (system-)samlinger (`isBase`, filter-chips pr. måltid) og retter (`Recipe`: `title`,
  `subtitle`, `category`, `timeMinutes`, `servings`, `ingredients[{name, quantity}]`,
  `steps[]`, makroer og måltid), der "skal komme fra backenden". Intet endpoint findes.
  Forslag: `GET /api/v1/meal-collections/system` (eller et `isSystem`-flag) og
  `GET /api/v1/recipes` + `GET /api/v1/recipes/{id}`, plus mulighed for at logge en ret.
  Appen viser dem tomme indtil da.
- **G10 (major, går på tværs af domæner) – CORS er ikke konfigureret.** `Program.cs` har
  hverken `AddCors` eller `UseCors`, og preflight giver 405. Browser-dev
  (`http://localhost:4200`) og Capacitor-WebView (`capacitor://localhost`,
  `https://localhost`) kan ikke kalde API'et direkte. Forslag: CORS-policy for de
  origins. Appen omgår det med dev-proxy og `CapacitorHttp`.
- **G11 (minor) – Milliliter kræver en manuel konvertering.** `FoodNutritionCalculator`
  kræver en `FoodServing` for alle enheder undtagen `Gram`, også `Milliliter`. Scannede
  væsker (næring pr. 100 ml) fejler derfor i en samling med 400 "Food X has no conversion
  for Milliliter", medmindre appen først laver `PUT /foods/{id}/servings/Milliliter`.
  Forslag: 1 ml = 1 g som fallback, eller et `per100Unit` (`Gram|Milliliter`) på `Food`.
