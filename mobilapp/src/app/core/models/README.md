# Modeller

App-dækkende typer, én fil pr. domæne. Kun typer – ingen logik.

| Fil                  | Typer                                                                                                                                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `meal.ts`            | `MealId`, `MealDefinition`, `MealTone` (måltidets farve i designets `mealTints`)                                                                                                                                                                                               |
| `food.ts`            | `Macros`, `FoodItem`, `LoggedFood`, `DailyFoodTotals`, `CustomFoodInput`, `Ingredient`, `Recipe`, `FoodCollection`, `NewCollectionInput`                                                                                                                                       |
| `profile.ts`         | `Gender`, `GoalId`, `PaceId`, `IntensityId`, `ProfilePhoto`, `UserProfile`, `GoalDefinition`, `PaceDefinition`, `ActivityLevel`, `IntensityDefinition`, `GenderDefinition`                                                                                                     |
| `weight.ts`          | `WeighEntry`, `WeightRange`, `WeightPoint`                                                                                                                                                                                                                                     |
| `nutrition.ts`       | `GoalWeightBounds`, `ParsedQuantity`, `PasswordStrength` (+ score/label-typer)                                                                                                                                                                                                 |
| `reminder.ts`        | `ReminderId`, `MealReminderId`, `WeekdayIndex`, `ClockTime`, `ReminderSetting(s)`, `ReminderDefinition`, `ReminderPermission`, `ScheduledReminder` og `ReminderNotifier` (platformens notifikationer bag et interface)                                                         |
| `keyboard.ts`        | `KeyboardPlatform` (skærmtastaturet bag et interface) og `KeyboardUnsubscribe`                                                                                                                                                                                                 |
| `session.ts`         | `SessionStatus` (`guest` · `pending-verification` · `authenticated`), `AuthTokens`, `SessionState`                                                                                                                                                                             |
| `theme.ts`           | `Theme` og `SystemBarsPlatform` (status- og navigationsbaren bag et interface)                                                                                                                                                                                                 |
| `language.ts`        | `Language` (`da` \| `en`)                                                                                                                                                                                                                                                      |
| `tone.ts`            | `Tone` – semantisk farvetone, som UI oversætter til tokens (`accent`, `positive`, `negative`, `info`, `selected`, `neutral`, `secondary`, `muted`, `warning`)                                                                                                                  |
| `api-error.ts`       | `ApiError` – fejl med en oversættelsesnøgle (`messageKey`) til en brugerrettet tekst og evt. HTTP-`status` (0 = intet svar)                                                                                                                                                    |
| `api.ts`             | API'ets fælles former: `CursorPage<T>` (`items`, `nextCursor`, `hasMore`), `ProblemDetails` (alle tre fejlformer; `errors` ved valideringsfejl) og `StoreStatus` (`idle` · `loading` · `ready` · `error` for API-baserede stores)                                              |
| `barcode.ts`         | `BarcodeScanOutcome` (hvordan en kamerascanning endte), `CameraPermission`, `BarcodeScannerPlatform` (kameraet bag et interface), `ScannedProduct` (vare pr. 100 g + `servingGrams`) og `ProductLookupResult`                                                                  |
| `open-food-facts.ts` | Open Food Facts' API-model: `OpenFoodFactsProductResponse`, `OpenFoodFactsProduct`, `OpenFoodFactsNutriments`. Mappes til `ScannedProduct` i `ProductLookupService`                                                                                                            |
| `food-api.ts`        | Mad-API'ets kontrakt: `ApiQuantityUnit`, `ApiMealType`, `FoodDto`, `FoodServingDto`, `CreateFoodRequest`, `UpsertFoodServingRequest`, `FoodLogDto`, `CreateFoodLogRequest`, `UpdateFoodLogRequest` – se Konventioner.                                                          |
| `profile-api.ts`     | Profil-API'ets kontrakt: `UserProfileDto`, `PatchUserProfileRequest` (alle felter valgfri), `UserGoalDto` (API'ets kalorie- og makromål), `CreateUserGoalRequest`, `UserSettingDto`, `UpsertUserSettingRequest`, `LatestWeightDto`. Mappes i `user-profile/profile-mapping.ts` |
| `auth.ts`            | Auth-API'ets kontrakt: `RegisterRequest` (fladt), `UserDto`, `LoginRequest`, `AuthResponse`, `RefreshRequest`, `VerifyEmailRequest`, `EmailRequest`, `ResetPasswordRequest` og enum-værdierne `ApiGender`, `ApiTrainingIntensity`, `ApiGoalType`                               |

## Konventioner

- Datoer og tidspunkter gemmes som ISO-strenge (`loggedAt`, `at`, `birthday`), så de kan
  serialiseres direkte til storage.
- `FoodItem.quantity` er portionsteksten, makroerne gælder for (`'250 g'`, `'1 portion'`).
- `DailyFoodTotals` er én dags summerede makroer fra madloggen; `entryCount` er 0 på dage
  uden log. `CustomFoodInput` er de felter, en egen vare oprettes og redigeres med.
  `NutritionCalculator.parseQuantity()` splitter den i tal og enhed.
- `food-api.ts` er mad-API'ets former: `FoodDto` er brugerens egen vare pr. 100 g med sine
  `servings`, og `FoodLogDto` har de forbrugte værdier og `mealType`. De mappes i
  `food-log/food-log-mapping.ts`.
- `FoodCollection.icon` er typen `CollectionIconName` fra `constants/collection-icons.ts`.
- **API-modeller er adskilt fra UI-modeller.** Typerne i `auth.ts`/`api.ts` har API'ets
  camelCase-navne og PascalCase-enums (`'Male'`, `'LoseWeight'`); mapningen til appens egne
  typer (`'mand'`, `'tabe'`) sker i servicelaget (`auth-mapping.ts`, `profile-mapping.ts`). API'ets tidsstempler er
  UTC med `Z` – læs dem med `parseApiDateTime()`.
