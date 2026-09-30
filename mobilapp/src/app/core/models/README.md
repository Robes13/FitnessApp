# Modeller

App-dækkende typer, én fil pr. domæne. Kun typer – ingen logik.

| Fil                  | Typer                                                                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meal.ts`            | `MealId`, `MealDefinition`, `MealTone` (måltidets farve i designets `mealTints`)                                                                                                                                       |
| `food.ts`            | `Macros`, `FoodItem`, `LoggedFood`, `DailyFoodTotals`, `CustomFoodInput`, `Ingredient`, `Recipe`, `FoodCollection`, `NewCollectionInput`                                                                               |
| `profile.ts`         | `Gender`, `GoalId`, `PaceId`, `IntensityId`, `UnitSystem`, `ProfilePhoto`, `UserProfile`, `GoalDefinition`, `PaceDefinition`, `ActivityLevel`, `IntensityDefinition`, `GenderDefinition`, `UnitSystemDefinition`       |
| `weight.ts`          | `WeighEntry`, `WeightRange`, `WeightPoint`                                                                                                                                                                             |
| `nutrition.ts`       | `GoalWeightBounds`, `ParsedQuantity`, `PasswordStrength` (+ score/label-typer)                                                                                                                                         |
| `reminder.ts`        | `ReminderId`, `MealReminderId`, `WeekdayIndex`, `ClockTime`, `ReminderSetting(s)`, `ReminderDefinition`, `ReminderPermission`, `ScheduledReminder` og `ReminderNotifier` (platformens notifikationer bag et interface) |
| `keyboard.ts`        | `KeyboardPlatform` (skærmtastaturet bag et interface) og `KeyboardUnsubscribe`                                                                                                                                         |
| `session.ts`         | `SessionState`                                                                                                                                                                                                         |
| `theme.ts`           | `Theme` og `SystemBarsPlatform` (status- og navigationsbaren bag et interface)                                                                                                                                         |
| `language.ts`        | `Language` (`da` \| `en`)                                                                                                                                                                                              |
| `tone.ts`            | `Tone` – semantisk farvetone, som UI oversætter til tokens (`accent`, `positive`, `negative`, `info`, `selected`, `neutral`, `secondary`, `muted`, `warning`)                                                          |
| `api-error.ts`       | `ApiError` – fejl med en oversættelsesnøgle (`messageKey`) til en brugerrettet tekst                                                                                                                                   |
| `barcode.ts`         | `BarcodeScanOutcome` (hvordan en kamerascanning endte), `CameraPermission`, `BarcodeScannerPlatform` (kameraet bag et interface), `ScannedProduct` (vare pr. 100 g + `servingGrams`) og `ProductLookupResult`          |
| `open-food-facts.ts` | Open Food Facts' API-model: `OpenFoodFactsProductResponse`, `OpenFoodFactsProduct`, `OpenFoodFactsNutriments`. Mappes til `ScannedProduct` i `ProductLookupService`                                                    |
| `auth.ts`            | Auth-API'ets kontrakt: `RegisterRequest` (body til registrering) og `VerificationStatusResponse`                                                                                                                       |

## Konventioner

- Datoer og tidspunkter gemmes som ISO-strenge (`loggedAt`, `at`, `birthday`), så de kan
  serialiseres direkte til storage.
- `FoodItem.quantity` er portionsteksten, makroerne gælder for (`'250 g'`, `'1 portion'`).
- `DailyFoodTotals` er én dags summerede makroer fra madloggen; `entryCount` er 0 på dage
  uden log. `CustomFoodInput` er de felter, en egen vare oprettes og redigeres med.
  `NutritionCalculator.parseQuantity()` splitter den i tal og enhed.
- `FoodCollection.icon` er typen `CollectionIconName` fra `constants/collection-icons.ts`.
