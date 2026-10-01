import { QUANTITY_UNIT_BY_TOKEN, TOKEN_BY_QUANTITY_UNIT } from '../../constants/food';
import { MEAL_BY_MEAL_TYPE } from '../../constants/meals';
import { FoodItem, LoggedFood, Macros } from '../../models/food';
import { ApiQuantityUnit, CreateFoodRequest, FoodDto, FoodLogDto } from '../../models/food-api';
import { ParsedQuantity } from '../../models/nutrition';
import { parseApiDateTime } from '../../utils/api';
import { roundTo } from '../../utils/math';

/** The nutrition fields of a `CreateFoodRequest`. */
export type Per100 = Pick<
  CreateFoodRequest,
  'caloriesPer100' | 'proteinPer100' | 'carbohydratesPer100' | 'fatPer100'
>;

const PER_100 = 100;
/** The API stores nutrition as `numeric(7,2)`. */
const PER_100_DECIMALS = 2;
/** Units whose nutrition really is per 100 (1 ml = 1 g). Other units are the synthetic 100 g unit. */
const PER_100_UNITS: readonly ApiQuantityUnit[] = ['Gram', 'Milliliter'];
/** A food's base portion per serving unit, in order of preference; without one it is 100 g. */
const BASE_PORTIONS: readonly (readonly [ApiQuantityUnit, number])[] = [
  ['Serving', 1],
  ['Piece', 1],
  ['Milliliter', 100],
];
const GRAM_BASE_PORTION = 100;

/** The API unit of an app token (`'g'` → `'Gram'`). */
export function toApiUnit(token: string): ApiQuantityUnit {
  // A token that isn't a unit counts as portions, so the log still sums to the item's values.
  return QUANTITY_UNIT_BY_TOKEN[token] ?? 'Serving';
}

/**
 * A catalogue food as a picker item. Its base portion comes from the servings the app creates:
 * `Serving` → `'1 portion'`, `Piece` → `'1 stk'`, `Milliliter` → `'100 ml'`, else `'100 g'`.
 * The macros keep the API's 2 decimals – the picker rounds once, when it scales the portion
 * (and when it shows the base), so its numbers match what the API logs.
 */
export function toFoodItem(food: FoodDto): FoodItem {
  const [unit, amount, grams] = basePortion(food);
  const scale = (per100: number): number => roundTo((per100 * grams) / PER_100, PER_100_DECIMALS);
  return {
    id: String(food.foodId),
    name: food.name,
    quantity: `${amount} ${TOKEN_BY_QUANTITY_UNIT[unit]}`,
    kcal: scale(food.caloriesPer100),
    protein: scale(food.proteinPer100),
    carbs: scale(food.carbohydratesPer100),
    fat: scale(food.fatPer100),
    isCustom: true,
  };
}

/**
 * A logged row with the API's exact consumed values, so day totals equal the API's sums
 * (`me/nutrition`, the data export). Screens round when they show a value.
 */
export function toLoggedFood(log: FoodLogDto): LoggedFood {
  return {
    logId: String(log.foodLogId),
    id: String(log.foodId),
    name: log.foodName,
    quantity: `${log.quantity} ${TOKEN_BY_QUANTITY_UNIT[log.unit]}`,
    kcal: log.caloriesConsumed,
    protein: log.proteinConsumed,
    carbs: log.carbohydratesConsumed,
    fat: log.fatConsumed,
    meal: MEAL_BY_MEAL_TYPE[log.mealType],
    loggedAt: parseApiDateTime(log.consumedAt).toISOString(),
    isCustom: true,
  };
}

/**
 * A portion (its macros, `amount` and unit token) as the API's per-100 values: `g`/`ml` → `value × 100 / amount`;
 * `stk`/`portion` → `value / amount` (per unit – see `SERVING_GRAMS_PER_UNIT`). 2 decimals.
 */
export function toPer100(input: Macros & ParsedQuantity): Per100 {
  const { amount, unit } = input;
  const factor = PER_100_UNITS.includes(toApiUnit(unit)) ? PER_100 / amount : 1 / amount;
  const per100 = (value: number): number => roundTo(value * factor, PER_100_DECIMALS);
  return {
    caloriesPer100: per100(input.kcal),
    proteinPer100: per100(input.protein),
    carbohydratesPer100: per100(input.carbs),
    fatPer100: per100(input.fat),
  };
}

/** `[unit, amount, grams]` of the food's base portion. */
function basePortion(food: FoodDto): readonly [ApiQuantityUnit, number, number] {
  for (const [unit, amount] of BASE_PORTIONS) {
    const serving = food.servings.find((candidate) => candidate.unit === unit);
    if (serving) {
      return [unit, amount, amount * serving.gramsPerUnit];
    }
  }
  return ['Gram', GRAM_BASE_PORTION, GRAM_BASE_PORTION];
}
