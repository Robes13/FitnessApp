import { ApiMealType } from '../models/food-api';
import { MealDefinition, MealId } from '../models/meal';

export const MEAL_IDS: readonly MealId[] = ['morgen', 'frokost', 'aften', 'snack'];

export const MEALS: readonly MealDefinition[] = [
  { id: 'morgen', labelKey: 'core.meals.breakfast' },
  { id: 'frokost', labelKey: 'core.meals.lunch' },
  { id: 'aften', labelKey: 'core.meals.dinner' },
  { id: 'snack', labelKey: 'core.meals.snack' },
];

/** The API's `mealType` per meal (plan-v2 A6). Lunch keeps the label "Frokost". */
export const MEAL_TYPE_BY_MEAL: Readonly<Record<MealId, ApiMealType>> = {
  morgen: 'Breakfast',
  frokost: 'Lunch',
  aften: 'Dinner',
  snack: 'Snack',
};

/** The reverse of `MEAL_TYPE_BY_MEAL` – a logged row's meal. */
export const MEAL_BY_MEAL_TYPE: Readonly<Record<ApiMealType, MealId>> = {
  Breakfast: 'morgen',
  Lunch: 'frokost',
  Dinner: 'aften',
  Snack: 'snack',
};
