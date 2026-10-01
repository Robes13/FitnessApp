import { Macros } from '../models/food';
import { ApiQuantityUnit } from '../models/food-api';

/** Food endpoints, relative to `API_BASE_URL`. */
export const FOOD_ENDPOINT = {
  FOODS: 'foods',
  serving: (foodId: number, unit: ApiQuantityUnit): string => `foods/${foodId}/servings/${unit}`,
  FOOD_LOGS: 'me/food-logs',
  foodLog: (foodLogId: string): string => `me/food-logs/${foodLogId}`,
} as const;

/** The API's largest page (`limit`) for foods and food logs. */
export const FOOD_API_PAGE_LIMIT = 100;

/** The longest food name the API accepts (`varchar(150)`). */
export const FOOD_NAME_MAX_LENGTH = 150;

/** The app's unit token in `FoodItem.quantity` (`'150 g'`) per API unit. Units the app never creates are shown lower-cased. */
export const TOKEN_BY_QUANTITY_UNIT: Readonly<Record<ApiQuantityUnit, string>> = {
  Gram: 'g',
  Milliliter: 'ml',
  Piece: 'stk',
  Serving: 'portion',
  Slice: 'slice',
  Cup: 'cup',
  Tablespoon: 'tablespoon',
  Teaspoon: 'teaspoon',
};

/** The reverse of `TOKEN_BY_QUANTITY_UNIT`: `g` → `Gram`, `ml` → `Milliliter`, `stk` → `Piece`, `portion` → `Serving`. */
export const QUANTITY_UNIT_BY_TOKEN: Readonly<Record<string, ApiQuantityUnit>> = Object.fromEntries(
  Object.entries(TOKEN_BY_QUANTITY_UNIT).map(([unit, token]) => [token, unit as ApiQuantityUnit]),
);

/**
 * The serving the app creates for a unit other than `Gram`, so the API can convert a log in it.
 *
 * ponytail: `Piece` and `Serving` are a synthetic 100 g unit – the spec's manual food is entered
 * per portion, while the API only stores nutrition per 100 g, so `…Per100` means "per unit" for
 * those private foods. Upgrade path: a nutrition basis per food in the API (api-gaps).
 */
export const SERVING_GRAMS_PER_UNIT: Readonly<Partial<Record<ApiQuantityUnit, number>>> = {
  Milliliter: 1,
  Piece: 100,
  Serving: 100,
};

/** Keeps every consumed value of one log inside FOOD_LOG numeric(7,2). */
export const FOOD_LOG_MAX_KCAL = 9999;
/** Keeps every consumed value of one log inside FOOD_LOG numeric(7,2). */
export const FOOD_LOG_MAX_MACRO_GRAMS = 999;

/** One log of `macros` would pass `FOOD_LOG_MAX_KCAL` / `FOOD_LOG_MAX_MACRO_GRAMS` (spec 3.2-5a: split it up). */
export function exceedsFoodLogCap({ kcal, protein, carbs, fat }: Macros): boolean {
  return (
    kcal > FOOD_LOG_MAX_KCAL ||
    [protein, carbs, fat].some((grams) => grams > FOOD_LOG_MAX_MACRO_GRAMS)
  );
}

/** The most kcal 100 g can hold (pure fat) – a larger value for a food in grams is a typo. */
export const MAX_KCAL_PER_100_GRAMS = 900;
