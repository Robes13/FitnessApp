# Modeller

App-dækkende typer, én fil pr. domæne. Kun typer – ingen logik.

| Fil            | Typer                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meal.ts`      | `MealId`, `MealDefinition`, `MealTone` (måltidets farve i designets `mealTints`)                                                                                                                                 |
| `food.ts`      | `Macros`, `FoodItem`, `LoggedFood`, `Ingredient`, `Recipe`, `FoodCollection`, `NewCollectionInput`, `ScanResult`                                                                                                 |
| `profile.ts`   | `Gender`, `GoalId`, `PaceId`, `IntensityId`, `UnitSystem`, `ProfilePhoto`, `UserProfile`, `GoalDefinition`, `PaceDefinition`, `ActivityLevel`, `IntensityDefinition`, `GenderDefinition`, `UnitSystemDefinition` |
| `weight.ts`    | `WeighEntry`, `WeightRange`, `WeightPoint`                                                                                                                                                                       |
| `nutrition.ts` | `GoalWeightBounds`, `ParsedQuantity`, `PasswordStrength` (+ score/label-typer)                                                                                                                                   |
| `session.ts`   | `SessionState`                                                                                                                                                                                                   |
| `theme.ts`     | `Theme`                                                                                                                                                                                                          |
| `tone.ts`      | `Tone` – semantisk farvetone, som UI oversætter til tokens (`accent`, `positive`, `negative`, `info`, `selected`, `neutral`, `secondary`, `muted`, `warning`)                                                    |
| `api-error.ts` | `ApiError` – fejl med dansk, brugerrettet `message`                                                                                                                                                              |

## Konventioner

- Datoer og tidspunkter gemmes som ISO-strenge (`loggedAt`, `at`, `birthday`), så de kan
  serialiseres direkte til storage.
- `FoodItem.quantity` er portionsteksten, makroerne gælder for (`'250 g'`, `'1 portion'`).
  `NutritionCalculator.parseQuantity()` splitter den i tal og enhed.
- `FoodCollection.icon` er typen `CollectionIconName` fra `constants/collection-icons.ts`.
