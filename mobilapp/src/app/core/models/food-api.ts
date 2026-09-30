/** The API's `QuantityUnit` (= `ServingUnit`), serialized by name. */
export type ApiQuantityUnit =
  'Gram' | 'Milliliter' | 'Piece' | 'Slice' | 'Cup' | 'Tablespoon' | 'Teaspoon' | 'Serving';

/** The API's `MealType` (plan-v2 A6). */
export type ApiMealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

/** How many grams one `unit` weighs – the API converts a log in that unit with it. */
export interface FoodServingDto {
  foodServingId: number;
  unit: ApiQuantityUnit;
  gramsPerUnit: number;
}

/** A food in the user's own catalogue (`GET/POST foods`). Nutrition is per 100 g. */
export interface FoodDto {
  foodId: number;
  name: string;
  barcode: string | null;
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
  createdByUserId: number;
  createdAt: string;
  servings: FoodServingDto[];
}

/** `POST foods`. `name` is 1–150 characters; a name the user already has gives 409. */
export interface CreateFoodRequest {
  name: string;
  barcode?: string;
  caloriesPer100: number;
  proteinPer100: number;
  carbohydratesPer100: number;
  fatPer100: number;
}

/** `PUT foods/{id}/servings/{unit}` – an upsert; the route's unit wins. */
export interface UpsertFoodServingRequest {
  gramsPerUnit: number;
}

/** A logged food. The consumed values are the API's snapshot at logging time. */
export interface FoodLogDto {
  foodLogId: number;
  foodId: number;
  foodName: string;
  quantity: number;
  unit: ApiQuantityUnit;
  caloriesConsumed: number;
  proteinConsumed: number;
  carbohydratesConsumed: number;
  fatConsumed: number;
  consumedAt: string;
  mealType: ApiMealType;
}

/** `POST me/food-logs`. A unit other than `Gram` needs a serving on the food. */
export interface CreateFoodLogRequest {
  foodId: number;
  quantity: number;
  unit: ApiQuantityUnit;
  consumedAt: string;
  mealType: ApiMealType;
}

/** `PATCH me/food-logs/{id}` – the API recalculates the values and keeps `mealType`. */
export interface UpdateFoodLogRequest {
  quantity?: number;
  unit?: ApiQuantityUnit;
}
